const
    PublicClassBuilder = require('./PublicClassBuilder.js');

let
    pcb = new PublicClassBuilder();

class Test {
    constructor() { }
    test() { }
    _test() { }
}

console.log(pcb.getPublicClass(Test));
