import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';

/**
 * Lit implementation of a counter web component. This mainly serves to validate using
 * dependencies with the extension.
 */
@customElement('my-counter-lit')
export class MyCounterLit extends LitElement {
    public static styles = css`
        :host {
            display: flex;
            gap: 5px;
        }
    `;

    @state()
    private count = 0;

    public render(): TemplateResult {
        return html`
            <span>Lit Counter: </span>
            <button @click=${this.decrement}>-</button>
            <span>${this.count}</span>
            <button @click=${this.increment}>+</button>
        `;
    }

    private decrement = (() => { this.count--; }).bind(this);
    private increment = (() => { this.count++; }).bind(this);
}
