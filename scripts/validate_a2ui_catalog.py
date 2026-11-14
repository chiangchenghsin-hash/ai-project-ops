#!/usr/bin/env python3
"""
BACKGROUND: Structural validator for A2UI v1.0 catalog files. Complements the
English-only localize gate: a catalog is machine-contract text, and a typo in a
function name or a missing $defs entry silently breaks agent/renderer pairing.
This checks the rules from the official catalog_definition.json schema without
requiring npm or a JSON-Schema library.
CONDITIONS: Python 3, standard library only. Run from any working directory;
pass one or more catalog paths as arguments. Exit 0 = all catalogs valid,
exit 1 = at least one violation. Deterministic output.
CHECKS: required root fields; protocolVersion == "1.0"; component names match
their const discriminator and are UAX #31 identifiers (str.isidentifier());
component properties reference only the documented common_types leaf names;
FunctionDefinition shape (@call const match, args object, returnType enum,
allowedCallers enum); $defs anyComponent/anyFunction cover exactly the defined
keys; no component may be named Surface (reserved by the spec).
VERSION: 1.0.0 - AUI-01 Stage A.
"""

import json
import os
import re
import sys

RETURN_TYPES = {"string", "number", "boolean", "array", "object", "validationResult", "any", "void"}
CALLERS = {"rendererOnly", "agentOnly", "rendererOrAgent"}
COMMON_TYPE_RE = re.compile(r"^common_types\.json#/\$defs/[A-Za-z_][A-Za-z0-9_]*$")
LOCAL_REF_RE = re.compile(r"^#/(components|functions)/[A-Za-z_][A-Za-z0-9_]*$")


def err(errors, msg):
    errors.append(msg)


def check_identifier(name, where, errors):
    if name == "Surface":
        err(errors, where + ": 'Surface' is reserved by the spec")
        return
    if not name.isidentifier():
        err(errors, where + ": '" + name + "' is not a UAX #31 identifier")


def check_dynamic_ref(ref, where, errors):
    if not isinstance(ref, str):
        err(errors, where + ": $ref must be a string")
        return
    if not (COMMON_TYPE_RE.match(ref) or LOCAL_REF_RE.match(ref)):
        err(errors, where + ": unexpected $ref '" + ref + "'")


def validate_component(name, schema, errors):
    where = "components." + name
    check_identifier(name, where, errors)
    if not isinstance(schema, dict) or schema.get("type") != "object":
        err(errors, where + ": must be an object schema")
        return
    props = schema.get("properties")
    if not isinstance(props, dict):
        err(errors, where + ": properties missing")
        return
    const = props.get("component", {}).get("const")
    if const != name:
        err(errors, where + ": properties.component.const must equal '" + name + "'")
    required = schema.get("required", [])
    if "component" not in required:
        err(errors, where + ": required must include 'component'")
    for pname, pschema in props.items():
        if not pname.isidentifier():
            err(errors, where + ": property '" + pname + "' is not a UAX #31 identifier")
        if isinstance(pschema, dict) and "$ref" in pschema:
            check_dynamic_ref(pschema["$ref"], where + "." + pname, errors)


def validate_function(name, schema, errors):
    where = "functions." + name
    check_identifier(name, where, errors)
    if not isinstance(schema, dict) or schema.get("type") != "object":
        err(errors, where + ": must be an object schema")
        return
    props = schema.get("properties")
    if not isinstance(props, dict):
        err(errors, where + ": properties missing")
        return
    if props.get("@call", {}).get("const") != name:
        err(errors, where + ": properties.@call.const must equal '" + name + "'")
    if "args" not in props:
        err(errors, where + ": properties.args missing")
    elif not isinstance(props["args"], dict) or props["args"].get("type") != "object":
        err(errors, where + ": properties.args must be an object schema")
    required = schema.get("required", [])
    if "@call" not in required:
        err(errors, where + ": required must include '@call'")
    ret = schema.get("returnType")
    if ret not in RETURN_TYPES:
        err(errors, where + ": returnType must be one of " + ",".join(sorted(RETURN_TYPES)))
    callers = schema.get("allowedCallers", "rendererOnly")
    if callers not in CALLERS:
        err(errors, where + ": allowedCallers must be one of " + ",".join(sorted(CALLERS)))
    if schema.get("requiresUserActivation") is True and callers != "rendererOnly":
        err(errors, where + ": requiresUserActivation=true forces allowedCallers=rendererOnly")


def check_defs(defs, components, functions, errors):
    if not isinstance(defs, dict):
        err(errors, "$defs missing")
        return
    for key in ("anyComponent", "anyFunction"):
        if key not in defs:
            err(errors, "$defs." + key + " missing")
    comp_refs = set()
    for entry in defs.get("anyComponent", {}).get("oneOf", []):
        ref = entry.get("$ref", "")
        m = LOCAL_REF_RE.match(ref)
        if m and m.group(1) == "components":
            comp_refs.add(ref.rsplit("/", 1)[1])
    if comp_refs != set(components):
        err(errors, "$defs.anyComponent must cover exactly: " + ",".join(sorted(components)))
    fn_refs = set()
    any_fn = defs.get("anyFunction", {})
    if functions and "not" in any_fn:
        err(errors, "$defs.anyFunction must list functions when functions are defined")
    for entry in any_fn.get("oneOf", []):
        ref = entry.get("$ref", "")
        m = LOCAL_REF_RE.match(ref)
        if m and m.group(1) == "functions":
            fn_refs.add(ref.rsplit("/", 1)[1])
    if fn_refs != set(functions):
        err(errors, "$defs.anyFunction must cover exactly: " + ",".join(sorted(functions)))


def validate(path):
    errors = []
    try:
        with open(path, "r", encoding="utf-8") as fh:
            doc = json.load(fh)
    except (OSError, ValueError) as exc:
        return [str(exc)]
    for field in ("catalogId", "protocolVersion", "title", "components", "$defs"):
        if field not in doc:
            err(errors, "root: '" + field + "' missing")
    if doc.get("protocolVersion") != "1.0":
        err(errors, "root: protocolVersion must be '1.0'")
    catalog_id = doc.get("catalogId", "")
    if not isinstance(catalog_id, str) or not catalog_id:
        err(errors, "root: catalogId must be a non-empty string")
    components = doc.get("components", {})
    functions = doc.get("functions", {})
    if not isinstance(components, dict) or not components:
        err(errors, "components must be a non-empty object")
    else:
        for name, schema in components.items():
            validate_component(name, schema, errors)
    if not isinstance(functions, dict):
        err(errors, "functions must be an object")
    else:
        for name, schema in functions.items():
            validate_function(name, schema, errors)
    check_defs(doc.get("$defs"), components if isinstance(components, dict) else {},
               functions if isinstance(functions, dict) else {}, errors)
    return errors


def main():
    if len(sys.argv) < 2:
        print("usage: validate_a2ui_catalog.py <catalog.json> [...]")
        return 2
    failed = 0
    for path in sys.argv[1:]:
        errors = validate(path)
        rel = os.path.relpath(path).replace(os.sep, "/")
        if errors:
            failed += 1
            print("FAIL " + rel)
            for e in errors:
                print("  - " + e)
        else:
            print("OK " + rel)
    print("CATALOGS_VALID=" + str(failed == 0))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
