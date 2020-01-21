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
        super('');
        this.setStream(code);
        this.memory = new MemoryTape();
        this.status = 'stopped';
        this.op_chrs = '+-<>[],.';

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
    find() {
        let chr = this.get();
        // console.log(this.op_chrs.indexOf(chr), chr);
        while(this.op_chrs.indexOf(chr) === -1){
            this.next();
            chr = this.get();
        }
        return chr;
    }
    next() { this.skip(); }
    prev() { this.rewind(); }

    // BrainfuckInterpreter methods
    handleRetCode(c) {
        switch(c){
            case -1: this.status = 'stopped'; break; // Parse error
            case 1:  this.status = 'complete'; break; // Completed
            case 2:  this.status = 'waiting'; break; // Waiting for input
        }
    }

    run(ms=0) {
        if(this.status === 'running') return;
        if(this.end()) this.reset();
        this.status = 'running';
        if(ms > 0){
            let int_id = window.setInterval(() => {
                let s = this.step(true);
                if(s !== 0) window.clearInterval(int_id);
                if(this.end() || (['stopped','waiting','paused'].indexOf(this.status) > -1)){
                    window.clearInterval(int_id);
                }
            }, ms);
        }else{
            while(!this.end()){
                this.step();
                if(['stopped','waiting','paused'].indexOf(this.status) > -1) break;
            }
            if(this.status === 'running') this.status = 'stopped';
            UI.render();
        }
    }

    step(r=false, s=false) {
        if(r) UI.render();
        let cmd = this.op[this.find()];
        if(cmd){
            let c = cmd();
            if(c !== 0){
                this.handleRetCode(c);
                return c;
            }
        }
        this.next();
        if(s) this.pause();
        return 0;
    }

    stop() {
        this.status = 'stopped';
    }

    pause() {
        this.status = 'paused';
    }

    reset() {
        this.stop();
        this.memory = new MemoryTape();
        this.pos = 0;
    }
}

// Run stuff
const BFI = new BrainfuckInterpreter();

const UI = {
    cell_size: 60, //px
    num_cells: 0,
    tape: [],
    output: [],
    input: [],
    speed: 50,

    elems: {
        tape: document.querySelector('#tape'),
        queue: document.querySelector('#queue'),
        code: document.querySelector('#code'),
        input: document.querySelector('#input'),
        output: document.querySelector('#output'),
        status: document.querySelector('#status')
    },

    examples : {},

    init() {
        let w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0) - 40;
        this.num_cells = Math.floor(w/this.cell_size);
        if(this.num_cells % 2 === 1) this.num_cells--;
        for(let i = 0; i <= this.num_cells; i++){
            let cell = document.createElement('div');
            cell.classList.add('cell');
            this.elems.tape.append(cell);
        }
        this.cells = document.querySelectorAll('#tape > .cell');
        this.elems.code.innerHTML = UI.examples.helloworld;
        UI.setCodeStream();
        this.render();
    },

    putOutput(x) {
        this.output.push(x);
    },

    getInput() {
        if(this.input.length === 0) return null;
        return this.input.shift().value;
    },

    updateTape() {
        let j = BFI.memory.pos - (this.num_cells)/2;
        for(let i = 0; i <= this.num_cells; i++){
            let val = BFI.memory.tape[j] | 0;
            this.tape[i] = {
                value: val,
                ascii: String.fromCharCode(val),
                index: j++
            };
        }
    },

    setCodeStream() {
        if(this.elems.code.innerText.trim() === '') this.elems.code.classList.add('empty');
        else this.elems.code.classList.remove('empty');
        BFI.setStream(this.elems.code.innerText);
    },

    submitInput() {
        this.input = this.input.concat(this.elems.input.value.split('')
                        .map(n => {
                            return {
                                value: n.charCodeAt(0),
                                ascii: n
                            }
                        }));
        this.elems.input.value = '';
        if(BFI.status === 'waiting') BFI.run(BFI.render_steps);
        this.render();
    },

    runPauseCode() {
        switch(BFI.status){
            case 'paused':
            case 'stopped': BFI.run(this.speed); break;
            case 'running': BFI.pause(); break;
            default:
        }
    },

    switchAscii() {
        this.elems.tape.classList.toggle('switched');
        this.elems.queue.classList.toggle('switched');
    },

    resetCode() {
        BFI.reset();
        this.output = [];
        this.render();
    },

    stepCode() {
        BFI.step(true, true);
    },
    
    render() {
        let codedata = this.elems.code.innerText.split('');
        if('runningpaused'.indexOf(BFI.status) > -1) codedata[BFI.pos-1] = '<span>'+codedata[BFI.pos-1]+'</span>';
        this.elems.code.innerHTML = codedata.join('');

        this.updateTape();
        for(let i = 0; i < this.tape.length; i++){
            this.cells[i].innerHTML =   `<div class="ascii">${this.tape[i].ascii}</div>` +
                                        `<div class="value">${this.tape[i].value}</div>` +
                                        `<div class="index">${this.tape[i].index}</div>`;
        }
        
        this.elems.queue.innerHTML = '';
        for(let i = 0; i < this.input.length; i++){
            this.elems.queue.innerHTML +=`<div class="char">` +
                                            `<div class="value">${this.input[i].value}</div>` +
                                            `<div class="ascii">${this.input[i].ascii}</div>` +
                                        `</div>`;
        }

        if(this.output.length === 0){
            this.elems.output.innerHTML = '<span>Output will go here</span>';
        }else{
            this.elems.output.innerText = this.output.map(n => String.fromCharCode(n)).join('');
        }

        this.elems.status.innerHTML = BFI.status;
    }
}

UI.examples = {
    helloworld:
`[
From wikipedia: https://en.wikipedia.org/wiki/Brainfuck#Hello_World!

This program prints "Hello World!" and a newline to the screen, its
length is 106 active command characters. [It is not the shortest.]

This loop is an "initial comment loop", a simple way of adding a comment
to a BF program such that you don't have to worry about any command
characters. Any ".", ",", "+", "-", "<" and ">" characters are simply
ignored, the "[" and "]" characters just have to be balanced. This
loop and the commands it contains are ignored because the current cell
defaults to a value of 0; the 0 value causes this loop to be skipped.
]
++++++++               Set Cell #0 to 8
[
  >++++               Add 4 to Cell #1; this will always set Cell #1 to 4
  [                   as the cell will be cleared by the loop
      >++             Add 2 to Cell #2
      >+++            Add 3 to Cell #3
      >+++            Add 3 to Cell #4
      >+              Add 1 to Cell #5
      <<<<-           Decrement the loop counter in Cell #1
  ]                   Loop till Cell #1 is zero; number of iterations is 4
  >+                  Add 1 to Cell #2
  >+                  Add 1 to Cell #3
  >-                  Subtract 1 from Cell #4
  >>+                 Add 1 to Cell #6
  [<]                 Move back to the first zero cell you find; this will
                      be Cell #1 which was cleared by the previous loop
  <-                  Decrement the loop Counter in Cell #0
]                       Loop till Cell #0 is zero; number of iterations is 8

The result of this is:
Cell No :   0   1   2   3   4   5   6
Contents:   0   0  72 104  88  32   8
Pointer :   ^

>>.                     Cell #2 has value 72 which is 'H'
>---.                   Subtract 3 from Cell #3 to get 101 which is 'e'
+++++++..+++.           Likewise for 'llo' from Cell #3
>>.                     Cell #5 is 32 for the space
<-.                     Subtract 1 from Cell #4 for 87 to give a 'W'
<.                      Cell #3 was set to 'o' from the end of 'Hello'
+++.------.--------.    Cell #3 for 'rl' and 'd'
>>+.                    Add 1 to Cell #5 gives us an exclamation point
>++.                    And finally a newline from Cell #6`,

    tictactoe:
`    +>-[>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>++[-]->>>>+>>>+>>>+>>>+>>>+>    
>>+>>>+>>>+>>>++[-<+]-<<<<+<<++++[->++++++++<]<++[------>+<]>++<<+[--->++<]>++ 
<<-[--->+<]>------<+[-<+]-<[>>+[->+]-<[-]<<[-]+++[>[-]++++++++++.[-]+++[>+[>>+<<
-]>>[<<++[-<+]->++[->+]->-]<<+[-<+]->-[-[-[-[-[-[-[-[->>>]>>>]>>>]>>>]>>>]>>>]>>
>]>>>]>>>>>>>>>>>>>>>>>>>>> > > > > > > > > > > > > >>>>>>>>>>[+[-<+]-<<<<<<.>>>
>>>>]>[+[-<+]-<<<<                                            <<<.>>>>>>>>]>[+[-
<+]-<<<<<<<<.>>>                  tic tac toe                   >>>>>>]+[-<+]-<<
<<<.>>>-]<-]+++       to play: type a number (1 to 9) to         +++++++.[-]<<<<
<<[<<<<<<<<<<<+        place an X at that grid location          [--->++<]>+++.[
->+++++++<]>.++                                                  ++++.-[---->+<]
>+++.---[->+++<]           [  http://mitxela.com/  ]            >.+++[->++++<]>+
.+++++.-[->+++++<]                                            >.[--->+<]>-.+[-<+
]-<[-]>>>>]<[<<<<<<<++++[++++>---<]>+.[++++>---<]>-.+++[->+++<]>++.+[--->+<]>+.+
[---->+<]>+++.[--->+<]>-.[-]+[-<+]-<[-]>>>>]<[<<<<<<<<<<+[--->++<]>+++.[->++++++
+<]>.++++++.-[---->+<]>+++.++++++[->++<]>.+[--->+<]>.++++.++++[->+++<]>.--[--->+
<]>.[--->+<]>-.+[-<+]-<[-]>>>>]<+[-<+]-<[>>->>>>>>+[-<<<<[-]<<[-]>>>>-[>>[-]+<<+
<[-]<[-]<[-]<[-]-[----->+<]>---<,>[-<->]<[>>+>+<<<-]>>[<<+>>-]+++++++++[->-[<<]>
]>>-]<<<<[-]>>>>[-]+<<<<<<[>>+>+<<<-]>>[<<+>>-]>>]>>-<<<[-]<<[<->-]<-[-[-[-[-[-[
-[-[->>>]>>>]>>>]>>>]>>>]>>>]>>>]>>>]]>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>[->++[-<+]->>>>>[>>>[>>>[+[-<+]-<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>>>>>>>>>>[>
>>[>>>[+[-<+]-<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>>>>>>>>>>>>>>>>>>>[>>>[>>>[+[-
<+]-<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>[>>>>>>>>>[>>>>>>>>>[+[-<+]-<<<<<<<<<[-]
++[->+]->]]]+[-<+]->>>>>>>>[>>>>>>>>>[>>>>>>>>>[+[-<+]-<<<<<<<<<[-]++[->+]->]]]+
[-<+]->>>>>>>>>>>[>>>>>>>>>[>>>>>>>>>[+[-<+]-<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>
>[>>>>>>>>>>>>[>>>>>>>>>>>>[+[-<+]-<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>>>>>>>[>>
>>>>[>>>>>>[+[-<+]-<<<<<<<<<[-]++[->+]->]]]+[-<+]-<<<<<<<<<-[++[->+]-<<<<<<<<<<[
-]++[->+]->>>>[+[-<+]-<<<<<<<<<<[-]+[->+]->]+[-<+]->>>>>>>[+[-<+]-<<<<<<<<<<[-]+
[->+]->]+[-<+]->>>>>>>>>>[+[-<+]-<<<<<<<<<<[-]+[->+]->]+[-<+]->>>>>>>>>>>>>[+[-<
+]-<<<<<<<<<<[-]+[->+]->]+[-<+]->>>>>>>>>>>>>>>>[+[-<+]-<<<<<<<<<<[-]+[->+]->]+[
-<+]->>>>>>>>>>>>>>>>>>>[+[-<+]-<<<<<<<<<<[-]+[->+]->]+[-<+]->>>>>>>>>>>>>>>>>>>
>>>[+[-<+]-<<<<<<<<<<[-]+[->+]->]+[-<+]->>>>>>>>>>>>>>>>>>>>>>>>>[+[-<+]-<<<<<<<
<<<[-]+[->+]->]+[-<+]->>>>>>>>>>>>>>>>>>>>>>>>>>>>[+[-<+]-<<<<<<<<<<[-]+[->+]->]
+[-<+]-<<[-]>[-]+>>>>>>[>>>[>>[+[-<+]-<[-]<[-]++++[->+]->]]]>+[-<+]->>>>>[>>[>>>
>[+[-<+]-<[-]<[-]+++[->+]->]]]>+[-<+]->>>>[>>>>[>>>[+[-<+]-<[-]<[-]++[->+]->]]]>
+[-<+]->>>>>>>>>>>>>>[>>>[>>[+[-<+]-<[-]<[-]+++++++[->+]->]]]>+[-<+]->>>>>>>>>>>
>>>[>>[>>>>[+[-<+]-<[-]<[-]++++++[->+]->]]]>+[-<+]->>>>>>>>>>>>>[>>>>[>>>[+[-<+]
-<[-]<[-]+++++[->+]->]]]>+[-<+]->>>>>>>>>>>>>>>>>>>>>>>[>>>[>>[+[-<+]-<[-]<[-]++
++++++++[->+]->]]]>+[-<+]->>>>>>>>>>>>>>>>>>>>>>>[>>[>>>>[+[-<+]-<[-]<[-]+++++++
++[->+]->]]]>+[-<+]->>>>>>>>>>>>>>>>>>>>>>[>>>>[>>>[+[-<+]-<[-]<[-]++++++++[->+]
->]]]>+[-<+]->>>>>[>>>>>>>>>[>>>>>>>>[+[-<+]-<[-]<[-]++++++++[->+]->]]]>+[-<+]->
>>>>[>>>>>>>>[>>>>>>>>>>[+[-<+]-<[-]<[-]+++++[->+]->]]]>+[-<+]->>>>[>>>>>>>>>>[>
>>>>>>>>[+[-<+]-<[-]<[-]++[->+]->]]]>+[-<+]->>>>>>>>[>>>>>>>>>[>>>>>>>>[+[-<+]-<
[-]<[-]+++++++++[->+]->]]]>+[-<+]->>>>>>>>[>>>>>>>>[>>>>>>>>>>[+[-<+]-<[-]<[-]++
++++[->+]->]]]>+[-<+]->>>>>>>[>>>>>>>>>>[>>>>>>>>>[+[-<+]-<[-]<[-]+++[->+]->]]]>
+[-<+]->>>>>>>>>>>[>>>>>>>>>[>>>>>>>>[+[-<+]-<[-]<[-]++++++++++[->+]->]]]>+[-<+]
->>>>>>>>>>>[>>>>>>>>[>>>>>>>>>>[+[-<+]-<[-]<[-]+++++++[->+]->]]]>+[-<+]->>>>>>>
>>>[>>>>>>>>>>[>>>>>>>>>[+[-<+]-<[-]<[-]++++[->+]->]]]>+[-<+]->>>>>[>>>>>>>>>>>>
[>>>>>>>>>>>[+[-<+]-<[-]<[-]++++++++++[->+]->]]]>+[-<+]->>>>[>>>>>>>>>>>>>[>>>>>
>>>>>>>[+[-<+]-<[-]<[-]++[->+]->]]]>+[-<+]->>>>>>>>>>>[>>>>>>[>>>>>[+[-<+]-<[-]<
[-]++++++++[->+]->]]]>+[-<+]->>>>>>>>>>[>>>>>>>[>>>>>>[+[-<+]-<[-]<[-]++++[->+]-
>]]]>+[-<+]->>>>>>[>>>[>[+[-<+]-<[-]<[-]++++[->+]->]]]>+[-<+]->>>>>>[>[>>>>>[+[-
<+]-<[-]<[-]+++[->+]->]]]>+[-<+]->>>>[>>>>>[>>>[+[-<+]-<[-]<[-]++[->+]->]]]>+[-<
+]->>>>>>>>>>>>>>>[>>>[>[+[-<+]-<[-]<[-]+++++++[->+]->]]]>+[-<+]->>>>>>>>>>>>>>>
[>[>>>>>[+[-<+]-<[-]<[-]++++++[->+]->]]]>+[-<+]->>>>>>>>>>>>>[>>>>>[>>>[+[-<+]-<
[-]<[-]+++++[->+]->]]]>+[-<+]->>>>>>>>>>>>>>>>>>>>>>>>[>>>[>[+[-<+]-<[-]<[-]++++
++++++[->+]->]]]>+[-<+]->>>>>>>>>>>>>>>>>>>>>>>>[>[>>>>>[+[-<+]-<[-]<[-]++++++++
+[->+]->]]]>+[-<+]->>>>>>>>>>>>>>>>>>>>>>[>>>>>[>>>[+[-<+]-<[-]<[-]++++++++[->+]
->]]]>+[-<+]->>>>>>[>>>>>>>>>[>>>>>>>[+[-<+]-<[-]<[-]++++++++[->+]->]]]>+[-<+]->
>>>>>[>>>>>>>[>>>>>>>>>>>[+[-<+]-<[-]<[-]+++++[->+]->]]]>+[-<+]->>>>[>>>>>>>>>>>
[>>>>>>>>>[+[-<+]-<[-]<[-]++[->+]->]]]>+[-<+]->>>>>>>>>[>>>>>>>>>[>>>>>>>[+[-<+]
-<[-]<[-]+++++++++[->+]->]]]>+[-<+]->>>>>>>>>[>>>>>>>[>>>>>>>>>>>[+[-<+]-<[-]<[-
]++++++[->+]->]]]>+[-<+]->>>>>>>[>>>>>>>>>>>[>>>>>>>>>[+[-<+]-<[-]<[-]+++[->+]->
]]]>+[-<+]->>>>>>>>>>>>[>>>>>>>>>[>>>>>>>[+[-<+]-<[-]<[-]++++++++++[->+]->]]]>+[
-<+]->>>>>>>>>>>>[>>>>>>>[>>>>>>>>>>>[+[-<+]-<[-]<[-]+++++++[->+]->]]]>+[-<+]->>
>>>>>>>>[>>>>>>>>>>>[>>>>>>>>>[+[-<+]-<[-]<[-]++++[->+]->]]]>+[-<+]->>>>>>[>>>>>
>>>>>>>[>>>>>>>>>>[+[-<+]-<[-]<[-]++++++++++[->+]->]]]>+[-<+]->>>>[>>>>>>>>>>>>>
>[>>>>>>>>>>>>[+[-<+]-<[-]<[-]++[->+]->]]]>+[-<+]->>>>>>>>>>>>[>>>>>>[>>>>[+[-<+
]-<[-]<[-]++++++++[->+]->]]]>+[-<+]->>>>>>>>>>[>>>>>>>>[>>>>>>[+[-<+]-<[-]<[-]++
++[->+]->]]]>+[-<+]-<[>>+[-<+]->>>>>>>>>>>>>>>>>>>>>>>>>>>>[+[-<+]-<[-]<[-]+++++
+++++[->+]->]+[-<+]->>>>>>>>>>>>>>>>>>>>>>[+[-<+]-<[-]<[-]++++++++[->+]->]+[-<+]
->>>>>>>>>>[+[-<+]-<[-]<[-]++++[->+]->]+[-<+]->>>>[+[-<+]-<[-]<[-]++[->+]->]+[-<
+]->>>>>>>>>>>>>>>>>>>>>>>>>[+[-<+]-<[-]<[-]+++++++++[->+]->]+[-<+]->>>>>>>>>>>>
>>>>>>>[+[-<+]-<[-]<[-]+++++++[->+]->]+[-<+]->>>>>>>>>>>>>[+[-<+]-<[-]<[-]+++++[
->+]->]+[-<+]->>>>>>>[+[-<+]-<[-]<[-]+++[->+]->]+[-<+]->>>>>>>>>>>>>>>>[+[-<+]-<
[-]<[-]++++++[->+]->]+[-<+]->]>>+[-<+]-<<<<[+[->+]->>>>>>>>>>>>>>>>>[+[-<+]-<[-]
<[-]++[->+]->]+[-<+]->]>>>>+[-<+]-<<[>>>+[-<+]-<[-]<[+[-<+]->++[->+]-<<-]+[-<+]-
>-[-[-[-[-[-[-[-[->>>]>>>]>>>]>>>]>>>]>>>]>>>]>>>]>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
>>>>>>>>>>>>>->>++[-<+]->]>>>>+[-<+]-<<[-]>>>+[-<+]-<<<<[-]>>>>>+[-<+]->>>>>>[>>
>[>>>[+[-<+]-<<<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>>>>>>>>>>>[>>>[>>>[+[-<+]-<<<
<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>>>>>>>>>>>>>>>>>>>>[>>>[>>>[+[-<+]-<<<<<<<<<<
<[-]++[->+]->]]]+[-<+]->>>>>>[>>>>>>>>>[>>>>>>>>>[+[-<+]-<<<<<<<<<<<[-]++[->+]->
]]]+[-<+]->>>>>>>>>[>>>>>>>>>[>>>>>>>>>[+[-<+]-<<<<<<<<<<<[-]++[->+]->]]]+[-<+]-
>>>>>>>>>>>>[>>>>>>>>>[>>>>>>>>>[+[-<+]-<<<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>>[
>>>>>>>>>>>>[>>>>>>>>>>>>[+[-<+]-<<<<<<<<<<<[-]++[->+]->]]]+[-<+]->>>>>>>>>>>>[>
>>>>>[>>>>>>[+[-<+]-<<<<<<<<<<<[-]++[->+]->]]]+[-<+]-<[-]]++[->+]->]+[-<+]-<+[ 
   -<+]-<]>>+[->+]->>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>+[-[-]<+]-<+[-[-]<+]-<+>]    `
};