/**
 * @module PublicClassBuilder
 * @author Simon Petrac
 */

const
    _privateMap = new WeakMap();

function filterPublic(obj) {
    const _private = _privateMap.get(this);

    if (_private.publicInstancesMap.has(obj))
        return _private.publicInstancesMap.get(obj);
    if (_private.publicClassesMap.has(obj))
        return _private.publicClassesMap.get(obj);
    else if (Array.isArray(obj))
        return obj.map(elem => filterPublic.call(this, elem));
    else if (typeof obj === 'promise')
        return new Promise((resolve, reject) => obj.then(result => resolve(filterPublic.call(this, result))).catch(reject));
    else
        return obj;
} // PublicClassBuilder~filterPublic

function filterPrivate(obj) {
    const _private = _privateMap.get(this);

    if (_private.privateInstancesMap.has(obj))
        return _private.privateInstancesMap.get(obj);
    if (_private.privateClassesMap.has(obj))
        return _private.privateClassesMap.get(obj);
    else if (Array.isArray(obj))
        return obj.map(elem => filterPrivate.call(this, elem));
    else if (typeof obj === 'promise')
        return new Promise((resolve, reject) => obj.then(result => resolve(filterPrivate.call(this, result))).catch(reject));
    else
        return obj;
} // PublicClassBuilder~filterPrivate

function buildPublicClass(PrivateClass) {
    const _private = _privateMap.get(this);

    /* 1. create the public class */
    class PublicClass {
        constructor(...publicArgs) {
            let privateInstance;

            if (publicArgs[0] instanceof PrivateClass) {
                /* 1.1a. constructed with a private instance, to get the public instance */
                privateInstance = publicArgs[0];

                if (_private.privateInstancesMap.has(privateInstance))
                    throw new Error(`${PublicClass.name}#constructor(privateInstance) -> privateInstance already has an associated publicInstance`);
            } else {
                /* 1.1b. constructed from the public class */
                let privatArgs = filterPublic.call(this, publicArgs);
                privateInstance = new PrivateClass(...privatArgs);
            }

            /* 1.2. save the relation between the public and private instance in the WeakMaps */
            _private.publicInstancesMap.set(this, privateInstance);
            _private.privateInstancesMap.set(privateInstance, this);
        } // PublicClass#constructor

        static _get(privateInstance) {
            if (_private.privateInstancesMap.has(privateInstance))
                return _private.privateInstancesMap.get(privateInstance);
            else if (privateInstance instanceof publicClassesMap.get(PublicClass))
                return new PublicClass(privateInstance);
            else
                throw new Error(`${PublicClass.name}._get(privateInstance) -> privateInstance does not relate to this public class`);
        } // PublicClass._get

    } // PublicClass

    /* 2. transfer all public properties of the class */
    for (let key of Reflect.ownKeys(PrivateClass)) {
        /* 2.1. skip private properties, etc. */
        if (typeof key !== 'string') continue;
        if (key.startsWith('_')) continue;
        if (key === 'prototype') continue;

        /* 2.2. get the complete property definition of the class */
        let privateProperty = Reflect.getOwnPropertyDescriptor(PrivateClass, key);
        let publicProperty = {};

        /* 2.3. some attributes of the property can easyly be transfered */
        if (privateProperty.configurable) publicProperty.configurable = true;
        if (privateProperty.enumerable) publicProperty.enumerable = true;

        if (privateProperty.get || privateProperty.set) {
            /* 2.4a. if the property is a getter/setter */
            if (privateProperty.get) {
                /* 2.4a.1. the getter */
                publicProperty.get = function () {
                    let privateResult = privateProperty.get.call(PrivateClass);
                    return filterPrivate.call(this, privateResult);
                };
            }

            if (privateProperty.set) {
                /* 2.4a.2. the setter */
                publicProperty.set = function (publicValue) {
                    let privatValue = filterPublic.call(this, publicValue);
                    privateProperty.set.call(PrivateClass, privatValue);
                };
            }
        } else {
            /* 2.4b. if the property is a value */
            if (privateProperty.writable) publicProperty.writable = true;

            if (typeof privateProperty.value === 'function') {
                /* 2.4b.1 usually its a function */
                publicProperty.value = function (...publicArgs) {
                    let privatArgs = filterPublic.call(this, publicArgs);
                    let privateResult = privateProperty.value.apply(PrivateClass, privatArgs);
                    return filterPrivate.call(this, privateResult);
                };
            } else {
                /* 2.4b.2 sometimes not */
                publicProperty.get = function () {
                    let privateResult = privateProperty.value;
                    return filterPrivate.call(this, privateResult);
                };
            }
        }

        /* 2.5. write the public property to the class */
        Object.defineProperty(PublicClass, key, publicProperty);
    }

    /* 3. transfer all public properties for the instances into the prototype */
    for (let protoKey of Reflect.ownKeys(PrivateClass.prototype)) {
        /** 3.1. skip private properties, etc. */
        if (typeof protoKey !== 'string') continue;
        if (protoKey.startsWith('_')) continue;
        if (protoKey === 'constructor') continue;

        /* 3.2. get the complete property definition of the prototype */
        let privateProtoProperty = Reflect.getOwnPropertyDescriptor(PrivateClass.prototype, protoKey);
        let publicProtoProperty = {};

        /* 3.3. some attributes of the property can easyly be transfered */
        if (privateProtoProperty.configurable) publicProtoProperty.configurable = true;
        if (privateProtoProperty.enumerable) publicProtoProperty.enumerable = true;

        if (privateProtoProperty.get || privateProtoProperty.set) {
            /* 3.4a. if the property is a getter/setter */
            if (privateProtoProperty.get) {
                /* 3.4a.1. the getter */
                publicProtoProperty.get = function () {
                    if (!_private.publicInstancesMap.has(this)) return;

                    let privateResult = privateProtoProperty.get.call(_private.publicInstancesMap.get(this));
                    return filterPrivate.call(this, privateResult);
                };
            }

            if (privateProtoProperty.set) {
                /* 3.4a.2. the setter */
                publicProtoProperty.set = function (publicValue) {
                    if (!_private.publicInstancesMap.has(this)) return;

                    let privatValue = filterPublic.call(this, publicValue);
                    privateProtoProperty.set.call(_private.publicInstancesMap.get(this), privatValue);
                };
            }
        } else {
            /* 3.4b. if the property is a value */
            if (privateProtoProperty.writable) publicProtoProperty.writable = true;

            if (typeof privateProtoProperty.value === 'function') {
                /* 3.4b.1 usually its a function */
                publicProtoProperty.value = function (...publicArgs) {
                    if (!_private.publicInstancesMap.has(this)) return;

                    let privatArgs = filterPublic.call(this, publicArgs);
                    let privateResult = privateProtoProperty.value.apply(_private.publicInstancesMap.get(this), privatArgs);
                    return filterPrivate.call(this, privateResult);
                };
            } else {
                /* 3.4b.2 sometimes not */
                publicProtoProperty.get = function () {
                    if (!_private.publicInstancesMap.has(this)) return;

                    let privateResult = privateProtoProperty.value;
                    return filterPrivate.call(this, privateResult);
                };
            }
        }

        /* 3.5. write the public property to the prototype */
        Object.defineProperty(PublicClass.prototype, protoKey, publicProtoProperty);
    }

    /* 4. public class is finished */
    return PublicClass;

} // PublicClassBuilder~buildPublicClass

class PublicClassBuilder {

    constructor() {
        const _private = {};

        _private.publicClassesMap = new Map();
        _private.privateClassesMap = new Map();

        _private.publicInstancesMap = new Map();
        _private.privateInstancesMap = new Map();

        _privateMap.set(this, _private);
    } // PublicClassBuilder#constructor

    getPublicClass(PrivateClass) {
        const _private = _privateMap.get(this);

        if (typeof PrivateClass !== 'function' || !PrivateClass.prototype)
            throw new Error(`PublicClassBuilder#getPublicClass(PrivateClass) -> PrivateClass has to be a class`);

        if (_private.privateClassesMap.has(PrivateClass)) {
            return _private.privateClassesMap.get(PrivateClass);
        } else {
            let PublicClass = buildPublicClass.call(this, PrivateClass);

            _private.privateClassesMap.set(PrivateClass, PublicClass);
            _private.publicClassesMap.set(PublicClass, PrivateClass);

            return PublicClass;
        }

    } // PublicClassBuilder#getPublicClass

} // PublicClassBuilder

module.exports = PublicClassBuilder;

