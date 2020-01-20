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
        this.setStream(input);
    }

    setStream(input) {
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
    constructor(code='') {
        super(code);
        this.memory = new MemoryTape();
        this.status = 'stopped';

        this.op = {
            '>': () => {
                this.memory.fwd();
                return 0;
            },
            '<': () => {
                this.memory.bwd();
                return 0;
            },
            '+': () => {
                this.memory.inc();
                return 0;
            },
            '-': () => {
                this.memory.dec();
                return 0;
            },
            '.': () => {
                UI.putOutput(this.memory.get());
                return 0;
            },
            ',': () => {
                let input = UI.getInput();
                if(!input) return 2;
                this.memory.put(input);
                return 0;
            },
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
                return 0;
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
                return 0;
            }
        }
    }

    // StringStream overrides/aliases
    get() { return this.stream.substring(this.pos, this.pos+1); }
    next() { this.skip(); }
    prev() { this.rewind(); }
    setCode(code) { this.setStream(code); }

    // BrainfuckInterpreter methods
    run(n=Infinity) {
        if(this.status === 'running') return;
        if(this.end()) this.reset();
        this.status = 'running';
        while(n-- > 0 && !this.end()){
            let s = this.step();
            if(s > 0){
                switch(s){
                    case 1: this.status = 'stopped'; break; // Parse error
                    case 2: this.status = 'waiting'; break; // Waiting for input
                }
                break;
            }
        }
        if(this.status === 'running') this.status = 'stopped';
        console.log(this.status);
        UI.render();
    }

    step(r=false) {
        let cmd = this.op[this.get()];
        if(cmd){
            let c = cmd();
            if(c > 0) return c;
        }
        this.next();
        if(r) UI.render();
        return 0;
    }

    reset() {
        this.status = 'stopped';
        this.pos = 0;
    }
}

// Run stuff
const BFI = new BrainfuckInterpreter();

const UI = {
    tape_len: 20,
    tape: [],
    output: [],
    input: [],

    code_elem: document.querySelector('#code'),
    input_elem: document.querySelector('#input'),
    output_elem: document.querySelector('#output'),
    tape_elem: document.querySelector('#tape'),
    cell_elems: [],

    init() {
        for(let i = 0; i <= this.tape_len; i++){
            let cell = document.createElement('div');
            cell.classList.add('cell');
            this.tape_elem.append(cell);
        }
        this.cells = document.querySelectorAll('#tape > .cell');
        this.render();
    },

    putOutput(x) {
        this.output.push(x);
    },

    getInput() {
        if(this.input.length === 0) return null;
        return this.input.shift();
    },

    updateTape() {
        let j = (-1 * this.tape_len/2) + BFI.memory.pos;
        for(let i = 0; i <= this.tape_len; i++){
            this.tape[i] = BFI.memory.tape[j++] | 0;
        }
    },

    updateCode() {
        BFI.setCode(this.code_elem.value);
    },

    submitInput() {
        this.input = this.input.concat(this.input_elem.value.split('').map(n => n.charCodeAt(0)));
        this.input_elem.value = '';
        if(BFI.status === 'waiting') BFI.run();
    },
    
    render() {
        this.output_elem.innerText = this.output.map(n => String.fromCharCode(n)).join('');

        this.updateTape();
        for(let i = 0; i < this.tape.length; i++){
            this.cells[i].innerText = this.tape[i];
        }
    }
}

UI.init();