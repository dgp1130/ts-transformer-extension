/** A counter implemented as a native web component. */
export class MyCounter extends HTMLElement {
    private count = 0;
    private label!: HTMLSpanElement;
    private decrementBtn!: HTMLButtonElement;
    private incrementBtn!: HTMLButtonElement;

    constructor() {
        super();

        const title = document.createElement('span');
        title.textContent = 'Counter: ';

        this.label = document.createElement('span');
        this.label.textContent = this.count.toString();

        this.decrementBtn = document.createElement('button');
        this.decrementBtn.textContent = '-';

        this.incrementBtn = document.createElement('button');
        this.incrementBtn.textContent = '+';

        this.append(title, this.decrementBtn, this.label, this.incrementBtn);
    }

    public connectedCallback(): void {
        this.decrementBtn.addEventListener('click', this.decrement);
        this.incrementBtn.addEventListener('click', this.increment);
    }

    public disconnectedCallback(): void {
        this.decrementBtn.removeEventListener('click', this.decrement);
        this.incrementBtn.removeEventListener('click', this.increment);
    }

    private decrement = (() => {
        this.count--;
        this.label.textContent = this.count.toString();
    }).bind(this);

    private increment = (() => {
        this.count++;
        this.label.textContent = this.count.toString();
    }).bind(this);
}

customElements.define('my-counter', MyCounter);
