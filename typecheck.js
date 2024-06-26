/*
* Typecheck.js version 1.2.6 by Gustav Lindberg
* https://github.com/GustavLindberg99/Typecheck.js
*/

"use strict";

const typechecked = (function(getTypeFromGlobalScope){
    let savedClasses = {};

    //Define these to be able to check if a function is an async function or a generator function
    const AsyncFunction = (async function(){}).constructor;
    const GeneratorFunction = (function*(){}).constructor;
    const AsyncGeneratorFunction = (async function*(){}).constructor;

    //Keywords that aren't allowed to be used as type names
    const reservedKeywords = [
        "arguments",
        //Not async since it's a special type
        "await",
        "break",
        "case",
        "catch",
        //Not class since it's a special type
        "const",
        "continue",
        "debugger",
        "default",
        "delete",
        "do",
        "else",
        "eval",
        "export",
        "extends",
        "false",
        "finally",
        "for",
        //Not function since it's a special type
        "if",
        "import",
        "in",
        "instanceof",
        "let",
        "new",
        //Not null since it's a special type
        "return",
        "static",
        "super",
        "switch",
        "this",
        "throw",
        "true",
        "try",
        "typeof",
        //Not undefined since it's a special type
        //Not var since it's a special type
        //Not void since it's a special type
        "while",
        "with",
        "yield"
    ];

    //All the functions and classes defined in this file use typecheck.js's type declaration syntax for readability, but can't actually be typechecked since that would cause infinite recursion

    class Type{
        #name /*: String */;
        #splitUnionTypes /*: Array<Type> */;
        #rawType /*: String | null */;
        #generics /*: Array<Type> | null */;
        #tupleElements /*: Array<Type> | null */;

        constructor(name /*: String */){
            Object.seal(this);

            this.#name = name.trim();

            if(this.#name === ""){
                throw new SyntaxError("Expected type name");
            }

            const invalidCharacter = this.#name.match(/[^a-zA-Z\u00aa-\uffdc0-9_$\.\s<>\[\],|*]/)?.[0];
            if(invalidCharacter !== undefined){
                throw new SyntaxError(`Invalid character '${invalidCharacter} in type declaration '${this}`);
            }
            if(/(?<!function|async)\*/.test(this.#name)){
                throw new SyntaxError(`Unexpected token '*' in type declaration '${this}'`)
            }

            this.#splitUnionTypes = this.#getSplitUnionTypes();
            this.#tupleElements = this.#getTupleElements();
            this.#rawType = this.#getRawType();
            this.#generics = this.#getGenerics();

            const illegalKeyword = this.#rawType?.split(".").find(it => reservedKeywords.includes(it));
            if(illegalKeyword !== undefined){
                throw new SyntaxError(`Unexpected reserved keyword '${illegalKeyword}' in type declaration ${this}`)
            }
        }

        toString() /*: String */ {
            return this.#name;
        }

        #splitOutsideGenericsAndTuples(str /*: String */, delimiter /*: String */) /*: Array<String> */ {
            const result = [""];
            let genericDepth = 0;
            let tupleDepth = 0;

            for(let i = 0; i < str.length; i++){
                switch(str[i]){
                case "<":
                    genericDepth++;
                    break;
                case ">":
                    genericDepth--;
                    if(genericDepth < 0){
                        throw new SyntaxError(`Unexpected token '>' in type declaration '${this}'`);
                    }
                    break;
                case "[":
                    tupleDepth++;
                    break;
                case "]":
                    tupleDepth--;
                    if(tupleDepth < 0){
                        throw new SyntaxError(`Unexpected token ']' in type declaration '${this}'`);
                    }
                    break;
                case delimiter:
                    if(genericDepth === 0 && tupleDepth === 0){
                        result.push("");
                        continue;
                    }
                    break;
                }
                result[result.length - 1] += str[i];
            }

            if(genericDepth > 0){
                throw new SyntaxError(`Unclosed generic in type declaration '${this}'`);
            }
            if(tupleDepth > 0){
                throw new SyntaxError(`Unclosed tuple in type declaration '${this}'`);
            }

            return result;
        }

        #getSplitUnionTypes() /*: Array<Type> */ {
            let genericDepth = 0;
            let tupleDepth = 0;

            const result = this.#splitOutsideGenericsAndTuples(this.#name, "|");

            if(result[0] === ""){
                throw new SyntaxError(`Expected type name before '|' token in type declaration '${this}'`);
            }
            else if(result.at(-1) === ""){
                throw new SyntaxError(`Expected type name after '|' token in type declaration '${this}'`);
            }
            else if(result.some(it => it === "")){
                throw new SyntaxError(`Unexpected token '|' in type declaration '${this}'`);
            }

            if(result.length === 1){
                return this;
            }
            return result.map(it => new Type(it));
        }

        #getTupleElements() /*: Array<Type> | null */ {
            if(this.#splitUnionTypes.length > 1){
                return null;
            }
            const match = this.#name.match(/^([^\[]*)\[(.*)\]([^\]]*)$/);
            if(match === null){
                return null;
            }
            else if(match[1] !== ""){
                //If the part before the tuple ends with a < character, the tuple is a generic argument, so then the type itself isn't a tuple
                if(match[1].trim().endsWith("<")){
                    return null;
                }
                //Otherwise it's a syntax error
                else{
                    throw new SyntaxError(`Garbage '${match[1]}' before tuple in type declaration '${this}' (for generics, use the syntax 'ContainerType<Type>')`);
                }
            }
            else if(match[3] !== ""){
                throw new SyntaxError(`Unexpected token '${match[3]}' in type declaration '${this}'`);
            }

            const tupleContent = match[2];
            const result = this.#splitOutsideGenericsAndTuples(tupleContent, ",");

            if(result[0] === ""){
                if(result.length === 1){
                    return [];
                }
                else{
                    throw new SyntaxError(`Expected type name before ',' token in generic in type declaration '${this}'`);
                }
            }
            else if(result.at(-1) === ""){
                throw new SyntaxError(`Expected type name after ',' token in generic in type declaration '${this}'`);
            }
            else if(result.some(it => it === "")){
                throw new SyntaxError(`Unexpected token ',' in type declaration '${this}'`);
            }

            return result.map(it => new Type(it));
        }

        #getRawType() /*: String | null */ {
            if(this.#splitUnionTypes.length > 1){
                return null;
            }
            if(this.#tupleElements !== null){
                return "Array";
            }
            const result = this.#name.replace(/<.+$/s, "").trim();

            const invalidCharacter = result.match(/[^a-zA-Z\u00aa-\uffdc0-9_$\.\s*]/)?.[0];
            if(invalidCharacter !== undefined){
                throw new SyntaxError(`Invalid character '${invalidCharacter} in type declaration '${this}`);
            }

            if(result === ""){
                throw new SyntaxError(`Missing type name before generic in type declaration '${this}'`);
            }
            else if(/\s/.test(result)){
                throw new SyntaxError(`Unexpected token '${result.split(/\s+/)[1]}' in type declaration '${this}'`);
            }
            else if(/^[0-9]/.test(result)){
                throw new SyntaxError(`Type names can't start with numbers, got '${result}'`);
            }
            return result;
        }

        #getGenerics() /*: Array<Type> | null */ {
            if(this.#splitUnionTypes.length > 1 || this.#tupleElements !== null){
                return null;
            }
            const match = this.#name.match(/^[^<]+<(.*)>([^>]*)$/);
            if(match === null){
                return null;
            }
            const genericContent = match[1];
            if(match[2] !== ""){
                throw new SyntaxError(`Unexpected token '${match[2]}' in type declaration '${this}'`);
            }
            else if(genericContent === ""){
                throw new SyntaxError(`Empty generic in type declaration '${this}'`);
            }

            const result = this.#splitOutsideGenericsAndTuples(genericContent, ",");

            if(result[0] === ""){
                throw new SyntaxError(`Expected type name before ',' token in generic in type declaration '${this}'`);
            }
            else if(result.at(-1) === ""){
                throw new SyntaxError(`Expected type name after ',' token in generic in type declaration '${this}'`);
            }
            else if(result.some(it => it === "")){
                throw new SyntaxError(`Unexpected token ',' in type declaration '${this}'`);
            }

            const typesThatSupportGenerics = ["Array", "Set", "Map"];
            if(!typesThatSupportGenerics.includes(this.#rawType)){
                throw new TypeError(`Generics are only supported on ${typesThatSupportGenerics}, not on '${this.#rawType}'`);
            }
            switch(result.length){
            case 1:
                if(this.#rawType === "Map"){
                    throw new TypeError(`Too few arguments for ${this.#rawType} generic in type declaration '${this}'`);
                }
                break;
            case 2:
                if(this.#rawType === "Map"){
                    break;
                }
                //No break
            default:
                throw new TypeError(`Too many arguments for ${this.#rawType} generic in type declaration '${this}'`);
            }

            return result.map(it => new Type(it));
        }

        isinstance(obj /*: var */) /*: Boolean */ {
            switch(this.#rawType){
            case null:    //Union types, there is no single raw type
                return this.#splitUnionTypes.some(it => it.isinstance(obj));
            case "var":
                return true;
            case "null":
                return obj === null;
            case "undefined":
            case "void":
                return obj === undefined;
            case "NaN":
                return typeof(obj) === "number" && isNaN(obj);
            case "function":
                return obj instanceof Function && !obj.toString().startsWith("class");
            case "function*":
                return obj instanceof GeneratorFunction && !obj.toString().startsWith("class");
            case "async":
                return obj instanceof AsyncFunction && !obj.toString().startsWith("class");
            case "async*":
                return obj instanceof AsyncGeneratorFunction && !obj.toString().startsWith("class");
            case "class":
                return obj instanceof Function && obj.hasOwnProperty("prototype") && !(obj instanceof GeneratorFunction || obj instanceof AsyncGeneratorFunction);
            default:
                const rawType = this.#rawType.split(".");
                let type = savedClasses[rawType[0]] ?? getTypeFromGlobalScope(rawType[0]);
                for(let subtype of rawType.slice(1)){
                    type = type?.[subtype];
                }
                if(type === undefined){
                    throw new ReferenceError(`'${this.#rawType}' in type declaration is not defined`);
                }
                else if(!classType.isinstance(type)){
                    throw new TypeError(`'${this.#rawType}' in type declaration does not name a type`);
                }
                if(!typechecked.isinstance(obj, type)){
                    return false;
                }
                if(this.#tupleElements !== null){
                    return obj.length === this.#tupleElements.length && this.#tupleElements.every((it, i) => it.isinstance(obj[i]));
                }
                else if(this.#generics?.length === 2){
                    for(let keyValuePair of obj){
                        if(!this.#generics[0].isinstance(keyValuePair[0]) || !this.#generics[1].isinstance(keyValuePair[1])){
                            return false;
                        }
                    }
                }
                else if(this.#generics?.length === 1){
                    for(let item of obj){
                        if(!this.#generics[0].isinstance(item)){
                            return false;
                        }
                    }
                }
                return true;
            }
        }
    }

    const classType = new Type("class");    //Save and reuse this for performance reasons

    class Parameter{
        name /*: String */;
        type /*: Type | null */ = null;
        parent /*: Parameter | null */;
        children /*: Array<Parameter> */ = [];
        isOptional /*: Boolean */ = false;
        destructuredType /*: class | null */ = null;
        isRestParameter = false;

        constructor(name /*: String */, parent /*: Parameter | null */ = null){
            Object.seal(this);

            this.name = name;
            this.parent = parent;
        }
    }

    class TypedFunction{
        name /*: String */;
        parameters /*: Array<Parameter> */ = [];
        returnType /*: Type | null */ = null;
        isArrowFunction /*: Boolean */;

        constructor(name /*: String */, functionString /*: String */){
            Object.seal(this);

            this.name = name;

            const typeDeclarationRegex = /^\s*\/\*:(.+?)\*\//si;
            let offset = 0;
            let atEndOfDestructuredParams = false;
            let currentParent = null;
            let parameterNames = [];

            const skipComments = (skipTypecheckingComments /*: Boolean */ = true, errorOnTypecheckingComments /*: Boolean */ = true) /*: void */ => {
                let commentMatch;
                while(commentMatch = functionString.slice(offset).match(skipTypecheckingComments ? /^\s*(\/\*:?|\/\/)/ : /^\s*(\/\*[^:]|\/\/)/)){    //This isn't a mistake, it should be =, not ===
                    if(commentMatch[1] === "/*:" && errorOnTypecheckingComments){
                        const entireComment = functionString.slice(offset, functionString.indexOf("*/", offset + 2) + 2).trim();
                        throw new SyntaxError(`Unexpected type declaration '${entireComment}'`);
                    }
                    else if(commentMatch[1] === "//"){
                        offset = functionString.indexOf("\n", offset);
                    }
                    else{
                        offset = functionString.indexOf("*/", offset + 2) + 2;
                    }
                    //Don't allow multiple type declarations one after the other
                    skipTypecheckingComments = true;
                    errorOnTypecheckingComments = true;
                }
            };
            const skipString = () /*: void */ => {
                const stringDelimiter = functionString[offset];
                if(!"\"'`".includes(stringDelimiter)){
                    return;
                }
                offset++;
                while(functionString[offset] !== stringDelimiter){
                    if(functionString[offset] === "\\"){
                        offset++;
                    }
                    offset++;
                }
                offset++;
            }

            //Skip initial comments, function keyword, name, etc
            let lastIdentifier = "";    //Used in case it's an arrow function with no parentheses
            let computedNameDepth = 0;
            while(computedNameDepth > 0 || /^\s*([a-z_$]|(\/[\/\*]|\[))/i.test(functionString.slice(offset))){
                if(functionString.slice(offset).trim()[0] === "["){
                    computedNameDepth++;
                    offset++;
                }
                else if(computedNameDepth > 0){
                    skipString();
                    switch(functionString[offset]){
                    case "[":
                        computedNameDepth++;
                        break;
                    case "]":
                        computedNameDepth--;
                        break;
                    }
                    offset++;
                }
                else{
                    offset += functionString.slice(offset).search(/\S/);
                    if(/^[a-z_$]/i.test(functionString.slice(offset))){
                        const oldOffset = offset;
                        offset += functionString.slice(offset).search(/[^a-z0-9_$\*]/i);    //Include * in case it's the function* keyword for generators
                        lastIdentifier = functionString.slice(oldOffset, offset);
                    }
                }
                skipComments();
            }
            offset += functionString.slice(offset).search(/\S/);
            if(functionString[offset] === "("){
                //Beginning of parameter list
                offset++;    //We're not interested in the initial (, we're interested in what comes after it
            }
            else if(functionString.substr(offset, 2) === "=>"){
                //If it's an arrow function without parentheses around the parameter, just check the number of parameters
                this.parameters = [new Parameter(lastIdentifier)];
                this.isArrowFunction = true;
                return;
            }
            else{
                //This shouldn't happen, but if it does just throw new an error so that we don't get stuck in an infinite loop later
                throw new SyntaxError(`Error when parsing typechecked function ${this.name}: Unexpected character '${functionString[offset]}' when parsing type declaration`);
            }

            //Find the parameter types
            while(atEndOfDestructuredParams || !/^\s*\)/.test(functionString.slice(offset))){
                skipComments(!atEndOfDestructuredParams);

                let parameterName;
                let isRestParameter = false;
                if(atEndOfDestructuredParams){
                    const joinedName = currentParent.children.map(it => it.name).join(", ");
                    if(currentParent.destructuredType === Array){
                        currentParent.name = `[${joinedName}]`;
                    }
                    else{
                        currentParent.name = `{${joinedName}}`;
                    }
                }
                else{
                    //Check for destructured parameters
                    let openingDestructuringMatch;
                    while(openingDestructuringMatch = functionString.slice(offset).match(/^\s*(\.\.\.)?\s*([\[\{])/)){    //This isn't a mistake, it should be =, not ===
                        currentParent = new Parameter("", currentParent);
                        offset += openingDestructuringMatch[0].length;
                        switch(openingDestructuringMatch[2]){
                        case "[":
                            currentParent.destructuredType = Array;
                            break;
                        case "{":
                            currentParent.destructuredType = Object;
                            break;
                        }
                        if(openingDestructuringMatch[1] !== undefined){
                            currentParent.isRestParameter = true;
                        }
                        skipComments();
                    }

                    //Find the parameter name
                    const paramMatch = functionString.slice(offset).match(/^\s*(\.\.\.)?\s*([a-z_$][a-z0-9_$]*)/i);
                    if(paramMatch[2] !== "" && parameterNames.includes(paramMatch[2])){
                        throw new SyntaxError(`Error when parsing typechecked function ${this.name}: Duplicate parameter name '${paramMatch[2]}' in typechecked function`);
                    }
                    parameterName = paramMatch[2];
                    offset += paramMatch[0].length;

                    //If there are top-level rest parameters, there is no max number of parameters
                    if(paramMatch[1] !== undefined){
                        isRestParameter = true;
                    }
                }

                skipComments(false);

                //Find the type declaration
                const typeMatch = functionString.slice(offset).match(typeDeclarationRegex);
                const parameter = atEndOfDestructuredParams ? currentParent : new Parameter(parameterName, currentParent);
                parameter.isRestParameter ||= isRestParameter;
                if(typeMatch !== null){
                    if(typeMatch[1].trim() === "void"){
                        throw new SyntaxError(`Error when parsing typechecked function ${this.name}: void can only be used as a return type`);
                    }
                    parameter.type = new Type(typeMatch[1]);
                }
                if(atEndOfDestructuredParams){
                    currentParent = currentParent.parent;
                }

                skipComments(true, false);

                //Check if there are optional parameters, and if there are, skip them
                parameter.isOptional = /^\s*=/.test(functionString.slice(offset));
                if(parameter.isOptional){
                    let arrayDepth = 0;
                    let objectDepth = 0;
                    let parenthesesDepth = 0;
                    offset = functionString.indexOf("=", offset);
                    skipComments();
                    while(arrayDepth > 0 || objectDepth > 0 || parenthesesDepth > 0 || !/^\s*[,)]/.test(functionString.slice(offset))){
                        switch(functionString[offset]){
                        case '"':
                        case "'":
                        case "`":
                            skipString();
                            offset--;    //To cancel out for the offset++ below
                            break;
                        case "[":
                            arrayDepth++;
                            break;
                        case "]":
                            arrayDepth--;
                            break;
                        case "{":
                            objectDepth++;
                            break;
                        case "}":
                            objectDepth--;
                            break;
                        case "(":
                            parenthesesDepth++;
                            break;
                        case ")":
                            parenthesesDepth--;
                            break;
                        }
                        if(arrayDepth < 0 || objectDepth < 0){
                            //It's possible to get a ] without a [ (and the same for {}) if it's a destructured parameter.
                            //If that's the case, we've reached the end of the optional parameter, so exit the loop.
                            break;
                        }
                        offset++;
                        skipComments();

                        //Check for end of file to avoid getting stuck in an infinite loop
                        if(offset >= functionString.length){
                            throw new SyntaxError(`Error when parsing typechecked function ${this.name}: Unexpected end of file when typechecking function`);
                        }
                    }
                }
                else if(currentParent?.destructuredType !== Object){
                    if((currentParent?.children ?? this.parameters).some(it => it.isOptional)){
                        throw new SyntaxError(`Error when parsing typechecked function ${this.name}: Parameter '${parameter.name}' is non-optional but is placed after an optional parameter`);
                    }
                }

                //Add to the parameter list
                if(currentParent === null){
                    this.parameters.push(parameter);
                }
                else{
                    currentParent.children.push(parameter);
                }

                //Skip the comma that separates parameters and the ] or } that closes destructured arrays or objects
                const closingMatch = functionString.slice(offset).match(/^\s*([\]\},])/);
                if(closingMatch !== null){
                    atEndOfDestructuredParams = closingMatch[1] !== ",";
                    offset += closingMatch[0].length;
                }
                else{
                    atEndOfDestructuredParams = false;
                }

                //Check for end of file to avoid getting stuck in an infinite loop
                if(offset >= functionString.length){
                    throw new SyntaxError(`Error when parsing typechecked function ${this.name}: Unexpected end of file when typechecking function`);
                }
            }

            //Find the return types
            offset = functionString.indexOf(")", offset) + 1;
            skipComments(false);
            const returnTypeMatch = functionString.slice(offset).match(typeDeclarationRegex);
            if(returnTypeMatch !== null){
                this.returnType = new Type(returnTypeMatch[1]);
            }
            skipComments(true, false);

            //Find if it's an arrow function
            this.isArrowFunction = /^\s*=>/.test(functionString.slice(offset));
        }

        checkArgs(args /*: Array */, parameters /*: Array<Parameter> */ = this.parameters, name /*: String */ = this.name) /*: void */ {
            //Check the number of parameters
            const minNumberOfParams = parameters.filter(it => !it.isOptional && !it.isRestParameter).length;
            const maxNumberOfParams = this.isArrowFunction || parameters.at(-1)?.isRestParameter ? Infinity : parameters.length;
            if(args.length < minNumberOfParams){
                throw new TypeError(`${args.length} arguments passed to ${name}, but at least ${minNumberOfParams} were expected.`);
            }
            if(args.length > maxNumberOfParams){
                throw new TypeError(`${args.length} arguments passed to ${name}, but at most ${maxNumberOfParams} were expected.`);
            }

            //Check the types of the parameters
            for(let i = 0; i < parameters.length && (i < args.length || parameters[i].isRestParameter); i++){
                const arg = parameters[i].isRestParameter ? args.slice(i) : args[i];
                if(!(parameters[i].type?.isinstance(arg) ?? true)){
                    throw new TypeError(`Expected parameter '${parameters[i].name}' of ${name} to be of type '${parameters[i].type}', got '${typeName(arg)}'`);
                }

                //Destructured parameters
                if(parameters[i].destructuredType === Array){
                    this.checkArgs(arg, parameters[i].children, `destructured parameter '${parameters[i].name}' of ${name}`);
                }
                else if(parameters[i].destructuredType === Object){
                    this.checkNamedArgs(arg, parameters[i].children, `destructured parameter '${parameters[i].name}' of ${name}`);
                }
            }
        }

        //For checking destructured object parameters
        checkNamedArgs(args /*: Object */, parameters /*: Array<Parameter> */, name /*: String */) /*: void */ {
            for(let parameter of parameters){
                //Check that the property exists in the object
                if(!(parameter.name in Object(args))){
                    if(parameter.isOptional){
                        continue;
                    }
                    else{
                        throw new TypeError(`Parameter passed as ${name} does not have a property named ${parameter.name}`);
                    }
                }

                //Check the type of the parameter
                const arg = args[parameter.name];
                if(!(parameter.type?.isinstance(arg) ?? true)){
                    throw new TypeError(`Expected parameter '${parameter.name}' of ${name} to be of type '${parameter.type}', got '${typeName(arg)}'`);
                }

                //Destructured parameters
                if(parameter.destructuredType === Array){
                    this.checkArgs(arg, parameter.children, `destructured parameter '${parameter.name}' of ${name}`);
                }
                else if(parameter.destructuredType === Object){
                    this.checkNamedArgs(arg, parameter.children, `destructured parameter '${parameter.name}' of ${name}`);
                }
            }
        }

        checkReturnValue(returnValue /*: var */) /*: void */ {
            if(this.returnType !== null && !this.returnType.isinstance(returnValue)){
                throw new TypeError(`Expected return value of ${this.name} to be of type '${this.returnType}', got '${typeName(returnValue)}'`);
            }
        }
    }

    function typeName(obj /*: var */) /*: String */ {
        if(obj === null){
            return "null";
        }
        else if(typeof(obj) === "number" && isNaN(obj)){
            return "NaN";
        }
        else if(obj instanceof Array || obj instanceof Set){
            let containedTypes = new Set();
            for(let item of obj){
                if(item === null){
                    containedTypes.add("null");
                }
                else if(typeof(item) === "number" && isNaN(item)){
                    containedTypes.add("NaN");
                }
                else{
                    containedTypes.add(String(item?.constructor.name));
                }
            }
            if(containedTypes.size > 0){
                return `${obj.constructor.name}<${[...containedTypes].join(" | ")}>`;
            }
        }
        else if(obj instanceof Map){
            let containedKeys = new Set();
            let containedValues = new Set();
            for(let keyValuePair of obj){
                if(keyValuePair[0] === null){
                    containedKeys.add("null");
                }
                else if(typeof(keyValuePair[0]) === "number" && isNaN(keyValuePair[0])){
                    containedTypes.add("NaN");
                }
                else{
                    containedKeys.add(String(keyValuePair[0]?.constructor.name));
                }
                if(keyValuePair[1] === null){
                    containedValues.add("null");
                }
                else if(typeof(keyValuePair[1]) === "number" && isNaN(keyValuePair[1])){
                    containedTypes.add("NaN");
                }
                else{
                    containedValues.add(String(keyValuePair[1]?.constructor.name));
                }
            }
            if(containedKeys.size > 0){
                return `${obj.constructor.name}<${[...containedKeys].join(" | ")}, ${[...containedValues].join(" | ")}>`;
            }
        }
        return String(obj?.constructor.name);
    }

    function typechecked(
        undecorated /*: function | class */,
        {
            name /*: String */ = undecorated.name,
            kind /*: String */ = undecorated.toString().startsWith("class") ? "class" : "function"
        } = {}
    ) /*: function | class */ {
        if(typeof(undecorated) !== "function"){
            throw new TypeError(`Expected parameter 'undecorated' of function 'typechecked' to be of type 'function | class', got '${typeName(undecorated)}'`);
        }
        if(typeof(name) !== "string"){
            throw new TypeError(`Expected parameter 'name' of function 'typechecked' to be of type 'String', got '${typeName(type)}'`);
        }
        if(typeof(kind) !== "string"){
            throw new TypeError(`Expected parameter 'kind' of function 'typechecked' to be of type 'String', got '${typeName(kind)}'`);
        }

        const readableName = (name !== "") ? `'${name}'` : "<anonymous>";
        const baseName = name.split(".").at(-1);

        switch(kind){
        case "class":
            //Same class names so that this is useable with modules
            if(name !== "" && !name.includes(".")){
                if(name in savedClasses || getTypeFromGlobalScope(name) !== undefined){
                    throw new ReferenceError(`Redefinition of class ${readableName} (typecheck.js doesn't support multiple typechecked classes with the same name, not even in different modules)`);
                }
                savedClasses[name] = undecorated;
            }

            //Type check the public methods
            const methods = [
                ...Object.entries(Object.getOwnPropertyDescriptors(undecorated)).map(([key, descriptor]) => {
                    descriptor.static = true;
                    descriptor.name = key;
                    return descriptor;
                }),
                ...Object.entries(Object.getOwnPropertyDescriptors(undecorated.prototype)).map(([key, descriptor]) => {
                    descriptor.static = false;
                    descriptor.name = key;
                    return descriptor;
                })
            ];
            for(let method of methods){
                if(method.name === "constructor"){
                    continue;
                }
                if(method.writable === false){
                    if(method.value instanceof Function || method.get instanceof Function || method.set instanceof Function){
                        console.warn(name + "." + method.name + " is not writable and can't be typechecked.");
                    }
                    continue;
                }
                const parentObject = method.static ? undecorated : undecorated.prototype;
                if(method.value instanceof Function){
                    parentObject[method.name] = typechecked(
                        method.value,
                        {
                            kind: typechecked.isinstance(method.value, "function") ? "method" : "class",
                            name: name + "." + method.name
                        }
                    );
                }
                else if(method.get instanceof Function || method.set instanceof Function){
                    let result = {};
                    if(method.get instanceof Function){
                        result.get = typechecked(method.get, {kind: "getter", name: method.name, static: method.static});
                    }
                    if(method.set instanceof Function){
                        result.set = typechecked(method.set, {kind: "setter", name: method.name, static: method.static});
                    }
                    Object.defineProperty(parentObject, method.name, result);
                }
            }

            //Type check the constructor
            const classString = undecorated.toString();
            let offset = 0;
            let depth = 0;
            for(let offset = 0; offset < classString.length; offset++){
                if(classString.substr(offset, 2) === "//"){
                    offset = classString.indexOf("\n", offset);
                }
                else if(classString.substr(offset, 2) === "/*"){
                    offset = classString.indexOf("*/", offset + 2) + 1;
                }
                else if(classString[offset] === '"' || classString[offset] === "'" || classString[offset] === "`"){
                    const stringDelimiter = classString[offset];
                    offset++;
                    while(classString[offset] !== stringDelimiter){
                        if(classString[offset] === "\\"){
                            offset++;
                        }
                        offset++;
                    }
                }
                else if(classString[offset] === "{"){
                    depth++;
                }
                else if(classString[offset] === "}"){
                    depth--;
                }
                else if(depth === 1 && classString.slice(offset).startsWith("constructor")){
                    const constructor = new TypedFunction(`${readableName} constructor`, classString.slice(offset));

                    if(constructor.returnType !== null){
                        throw new SyntaxError("Constructors can't have return types");
                    }

                    //Return the class with a typechecked constructor
                    //The {[name]: ...}[name] syntax is so that the class keeps its name, see https://stackoverflow.com/a/48813707/4284627
                    //The problem with using Object.defineProperty as we do for functions is that then the debugger will log instances as paramTypes.paramTypes{...} instead of ClassName{...}
                    return {[baseName]: class extends undecorated{
                        constructor(...args){
                            constructor.checkArgs(args);
                            super(...args);
                        }
                    }}[baseName];
                }
            }
            return undecorated;
        case "function":
        case "method":
        case "getter":
        case "setter":
            const func = new TypedFunction(readableName, undecorated.toString());

            if(kind === "setter" && func.returnType !== null){
                throw new SyntaxError("Setters can't have return types");
            }

            //Return the typechecked function
            let result;
            if(undecorated instanceof AsyncFunction){
                result = async function(...args){
                    func.checkArgs(args);
                    const returnValue = await (func.isArrowFunction ? undecorated(...args) : undecorated.call(this, ...args));
                    func.checkReturnValue(returnValue);
                    return returnValue;
                };
            }
            else if(undecorated instanceof GeneratorFunction){
                result = function*(...args){
                    func.checkArgs(args);
                    const generator = undecorated.call(this, ...args);    //It can't be an arrow function if it's a generator, see https://stackoverflow.com/q/27661306/4284627
                    for(let yeildValue = generator.next(); !yeildValue.done; yeildValue = generator.next()){
                        func.checkReturnValue(yeildValue.value);
                        yield yeildValue;
                    }
                }
            }
            else if(undecorated instanceof AsyncGeneratorFunction){
                result = async function*(...args){
                    func.checkArgs(args);
                    const generator = undecorated.call(this, ...args);
                    for(let yeildValue = await generator.next(); !yeildValue.done; yeildValue = await generator.next()){
                        func.checkReturnValue(yeildValue.value);
                        yield yeildValue;
                    }
                }
            }
            else{
                result = function(...args){
                    func.checkArgs(args);
                    const returnValue = func.isArrowFunction ? undecorated(...args) : undecorated.call(this, ...args);
                    if(kind === "setter"){
                        if(returnValue !== undefined){
                            throw new TypeError("Setters should not return anything");
                        }
                    }
                    else{
                        func.checkReturnValue(returnValue);
                    }
                    return returnValue;
                };
            }
            Object.defineProperty(result, "name", {value: baseName, writable: false});
            return result;
        default:
            throw new TypeError("typechecked is only allowed on classes, functions, methods, getters or setters, got " + context.kind);
        }
    }

    typechecked.isinstance = function(obj /*: var */, type /*: String | class | null | undefined | NaN */) /*: Boolean */ {
        if(type === null){
            return obj === null;
        }
        else if(type === undefined){
            return obj === undefined;
        }
        else if(Object.is(type, NaN)){
            return Object.is(obj, NaN);
        }
        else if(classType.isinstance(type)){
            if(obj === null || obj === undefined){    //Don't use == to avoid issues with document.all
                return false;
            }
            else if(type === Number){
                return typeof(obj) === "number" && !isNaN(obj);
            }
            else if(type === String){
                return typeof(obj) === "string";
            }
            else if(type === Boolean){
                return typeof(obj) === "boolean";
            }
            else if(type === Symbol){
                return typeof(obj) === "symbol";
            }
            else if(type === BigInt){
                return typeof(obj) === "bigint";
            }
            else{
                return Object(obj) instanceof type;
            }
        }
        else if(typeof(type) === "string"){
            return new Type(type).isinstance(obj);
        }
        else{
            throw new TypeError(`Expected parameter 'type' of function 'typechecked.isinstance' to be of type 'String | class | null | undefined | NaN', got '${typeName(type)}'`);
        }
    };

    typechecked.add = typechecked(function(...classes /*: Array<class> */) /*: void */ {
        for(let cls of classes){
            if(cls.name === ""){
                throw new ReferenceError("Cannot call typechecked.add on anonymous classes.");
            }

            const name = cls.name;
            if(name in savedClasses || getTypeFromGlobalScope(name) !== undefined){
                if(savedClasses[name] === cls){
                    //Don't do anything, calling typechecked.add twice should be allowed so that it can be called after import in each file
                    continue;
                }
                else if(classType.isinstance(savedClasses[name]) && cls.prototype instanceof savedClasses[name]){
                    throw new ReferenceError(`Cannot call typechecked.add on class '${name}': class is already known by typechecked. You don't need to call typechecked.add on classes that are themselves typechecked.`);
                }
                else if(getTypeFromGlobalScope(name) === cls){
                    throw new ReferenceError(`Cannot call typechecked.add on class '${name}': class is already known by typechecked. You don't need to call typechecked.add on classes that are members of globalThis.`);
                }
                else{
                    throw new ReferenceError(`Redefinition of class '${name}' (typecheck.js doesn't support multiple typechecked classes with the same name, not even in different modules)`);
                }
            }

            savedClasses[name] = cls;
        }
    }, {name: "typechecked.add"});

    return Object.freeze(typechecked);
})(function(){
    //Pass the getTypeFromGlobalScope function as a parameter to the IIFE so that the evals in here can't see any of the private stuff, not even the getTypeFromGlobalScope function itself.
    //For the same reason, use arguments instead of a named parameter.
    //This is important in case a user creates a user-defined class with the same name as a local variable of the IIFE.

    //For performance reasons, try globalThis[arguments[0]] first. This works fine for built-in types and is much faster than eval.
    if(globalThis[arguments[0]] !== undefined){
        return globalThis[arguments[0]];
    }

    //If it couldn't be found, try using eval because ES6 classes aren't automatically added to globalThis for some reason.
    if(eval(`typeof ${arguments[0]}`) === "undefined"){
        return undefined;
    }
    return eval(arguments[0]);
});

//Export typechecked in Node.js (no risk for false positives because in Node.js global variables defined in other files aren't visible here)
if(typeof(window) === "undefined"){
    module.exports = typechecked;
}

//Export typechecked in ES6 modules (the first statement makes sure we're in a module, see https://stackoverflow.com/a/72314371/4284627)
//Unfortunately there doesn't seem to be a nicer way of doing this
if(0)typeof await/2//2;export default typechecked;