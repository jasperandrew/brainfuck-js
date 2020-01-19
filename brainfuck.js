'use strict';

class MemoryTape {
    constructor(bits=8, signed=false) {
        if(signed){
            bits = bits - 1;
            let p = Math.pow(2, bits);
            this.max = p - 1;
            this.min = -1 * p;
        }else{
            this.max = Math.pow(2, bits) - 1;
            this.min = 0;
        }
        this.pos = 0;   // Current pointer position
        this.tape = {}; // Memory tape object
    }

    fwd() { this.pos++; } // Move pointer position forward
    bwd() { this.pos--; } // Move pointer position backward

    inc() { // Increment the value at the current position
        let v = this.tape[this.pos] | 0;
        if(v === this.max) this.tape[this.pos] = this.min; // Overflow
        else this.tape[this.pos] = v + 1;
    }

    dec() { // Decrement the value at the current position
        let v = this.tape[this.pos] | 0;
        if(v === this.min) this.tape[this.pos] = this.max; // Overflow
        else this.tape[this.pos] = v - 1;
    }

    get() { // Get the value in memory at the current position
        return this.tape[this.pos] | 0;
    }

    put(x) { // Put a value into memory at the current position
        if(typeof(x) !== 'number'){
            console.error('Not a number: ' + x);
            return;
        }
        
        this.tape[this.pos] = 0;
        if(x === 0) return;
        while(x !== 0){
            if(x > 0){
                this.inc();
                x--;
            }else{
                this.dec();
                x++;
            }
        }
    }
}

class StringStream {
    constructor(input) {
        this.stream = input.toString();
        this.pos = 0;
    }

    len() { return this.stream.length; }
    end() { return this.pos >= this.stream.length; }

    get(n=1) { // TODO // Check if stream ends
        let p = this.pos;
        this.pos = (p + n > this.stream.length ? this.stream.length : p + n);
        return this.stream.substring(p, this.pos);
    }

    skip(n=1) { // Skips characters in the stream. Returns the number of characters skipped.
        let p = this.pos;
        this.pos = (p + n > this.stream.length ? this.stream.length : p + n);
        return this.pos - p;
    }

    rewind(n=1) { // Moves the pointer backwards. Returns the number of characters rewound.
        let p = this.pos;
        this.pos = (p - n < 0 ? 0 : p - n);
        return p - this.pos;
    }
}

class BrainfuckInterpreter extends StringStream {
    constructor(code, input=null, output=null) {
        super(code);
        this.memory = new MemoryTape();
        this.input = input;
        this.output = output;
        this.outstr = '';

        this.op = {
            '>': () => { this.memory.fwd(); },
            '<': () => { this.memory.bwd(); },
            '+': () => { this.memory.inc(); },
            '-': () => { this.memory.dec(); },
            '.': () => { this.putOutput(this.memory.get()); },
            ',': () => { this.memory.put(this.getInput()); },
            '[': () => {
                if(this.memory.get() === 0){
                    this.next();
                    let nested = 0,
                        char = this.get();
                    while(char !== ']' || nested > 0){
                        if     (char === '[') nested++;
                        else if(char === ']') nested--;
                        this.next();
                        char = this.get();
                    }
                }
            },
            ']': () => {
                if(this.memory.get() !== 0){
                    this.prev();
                    let nested = 0,
                        char = this.get();
                    while(char !== '[' || nested > 0){
                        if     (char === ']') nested++;
                        else if(char === '[') nested--;
                        this.prev();
                        char = this.get();
                    }
                }
            }
        }
    }

    // Override
    get() {
        return this.stream.substring(this.pos, this.pos+1);
    }

    next() { this.skip(); }
    prev() { this.rewind(); }

    run(n=Infinity) {
        while(n-- > 0 && !this.end()){
            this.step();
            this.render();
        }
    }

    step() {
        // console.log(this.get());
        let cmd = this.op[this.get()];
        if(cmd) cmd();
        this.next();
    }

    putOutput(x) {
        this.outstr += String.fromCharCode(x);
        console.log(this.outstr);
    }

    getInput() {
        return prompt('Input char').charCodeAt(0);
    }

    render() {
        
    }
}