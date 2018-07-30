/**
 * @module Utility
 * @author Simon Petrac
 */

/**
 * Builds a public class by removing _ properties and instance attributes.
 * @function getPublicClass
 * @param {class} privateClass The source for the public class.
 * @returns {class} The public class with calls to the private properties.
 */
exports.getPublicClass = ((/* closure */) => {
    const publicClassesMap = new WeakMap();
    const privateClassesMap = new WeakMap();

    const publicInstancesMap = new WeakMap();
    const privateInstancesMap = new WeakMap();

    function filterPublicInstance(obj) {
        if (publicInstancesMap.has(obj))
            return publicInstancesMap.get(obj);
        else if (Array.isArray(obj))
            return obj.map(filterPublicInstance);
        else if (typeof obj === 'promise')
            return new Promise((resolve, reject) => obj.then(result => resolve(filterPublicInstance(result))).catch(reject));
        else
            return obj;
    } // filterPublicInstance

    function filterPrivateInstance(obj) {
        if (privateInstancesMap.has(obj))
            return privateInstancesMap.get(obj);
        else if (Array.isArray(obj))
            return obj.map(filterPrivateInstance);
        else if (typeof obj === 'promise')
            return new Promise((resolve, reject) => obj.then(result => resolve(filterPrivateInstance(result))).catch(reject));
        else
            return obj;
    } // filterPrivateInstance

    function getPublicClass(PrivateClass) {

        if (typeof PrivateClass !== 'function' || !PrivateClass.prototype)
            throw new Error(`getPublicClass(privateClass) -> privateClass has to be a class`);

        if (privateClassesMap.has(PrivateClass))
            return privateClassesMap.get(PrivateClass);

        /* 1. create the public class */
        class PublicClass {
            constructor(...publicArgs) {
                let privateInstance;

                if (publicArgs[0] instanceof PrivateClass) {
                    /* 1.1a. constructed with a private instance, to get the public instance */
                    privateInstance = publicArgs[0];

                    if (privateInstancesMap.has(privateInstance))
                        throw new Error(`${PublicClass.name}#constructor(privateInstance) -> privateInstance already has an associated publicInstance`);
                } else {
                    /* 1.1b. constructed from the public class */
                    let privatArgs = filterPublicInstance(publicArgs);
                    privateInstance = new PrivateClass(...privatArgs);
                }

                /* 1.2. save the relation between the public and private instance in the WeakMaps */
                publicInstancesMap.set(this, privateInstance);
                privateInstancesMap.set(privateInstance, this);
            } // PublicClass#constructor

            static _get(privateInstance) {
                if (privateInstancesMap.has(privateInstance))
                    return privateInstancesMap.get(privateInstance);
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
                        return filterPrivateInstance(privateResult);
                    };
                }

                if (privateProperty.set) {
                    /* 2.4a.2. the setter */
                    publicProperty.set = function (publicValue) {
                        let privatValue = filterPublicInstance(publicValue);
                        privateProperty.set.call(PrivateClass, privatValue);
                    };
                }
            } else {
                /* 2.4b. if the property is a value */
                if (privateProperty.writable) publicProperty.writable = true;

                if (typeof privateProperty.value === 'function') {
                    /* 2.4b.1 usually its a function */
                    publicProperty.value = function (...publicArgs) {
                        let privatArgs = filterPublicInstance(publicArgs);
                        let privateResult = privateProperty.value.apply(PrivateClass, privatArgs);
                        return filterPrivateInstance(privateResult);
                    };
                } else {
                    /* 2.4b.2 sometimes not */
                    publicProperty.get = function () {
                        let privateResult = privateProperty.value;
                        return filterPrivateInstance(privateResult);
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
                        if (!publicInstancesMap.has(this)) return;

                        let privateResult = privateProtoProperty.get.call(publicInstancesMap.get(this));
                        return filterPrivateInstance(privateResult);
                    };
                }

                if (privateProtoProperty.set) {
                    /* 3.4a.2. the setter */
                    publicProtoProperty.set = function (publicValue) {
                        if (!publicInstancesMap.has(this)) return;

                        let privatValue = filterPublicInstance(publicValue);
                        privateProtoProperty.set.call(publicInstancesMap.get(this), privatValue);
                    };
                }
            } else {
                /* 3.4b. if the property is a value */
                if (privateProtoProperty.writable) publicProtoProperty.writable = true;

                if (typeof privateProtoProperty.value === 'function') {
                    /* 3.4b.1 usually its a function */
                    publicProtoProperty.value = function (...publicArgs) {
                        if (!publicInstancesMap.has(this)) return;

                        let privatArgs = filterPublicInstance(publicArgs);
                        let privateResult = privateProtoProperty.value.apply(publicInstancesMap.get(this), privatArgs);
                        return filterPrivateInstance(privateResult);
                    };
                } else {
                    /* 3.4b.2 sometimes not */
                    publicProtoProperty.get = function () {
                        if (!publicInstancesMap.has(this)) return;

                        let privateResult = privateProtoProperty.value;
                        return filterPrivateInstance(privateResult);
                    };
                }
            }

            /* 3.5. write the public property to the prototype */
            Object.defineProperty(PublicClass.prototype, protoKey, publicProtoProperty);
        }

        /* 4. public class is finished */
        privateClassesMap.set(PrivateClass, PublicClass);
        publicClassesMap.set(PublicClass, PrivateClass);

        return PublicClass;

    } // getPublicClass

    return getPublicClass;
})(/* closure */); // exports.getPublicClass

