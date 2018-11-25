const
    PublicClassBuilder = require('./PublicClassBuilder.js');

let
    pcb = new PublicClassBuilder();

class Test {
    constructor() { }
    test() { }
    _test() { }
}

let PublicTest = pcb.getPublicClass(Test);

console.log(PublicTest);
