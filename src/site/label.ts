/** Updates the text to demonstrate a user-visible result from the script. */
export function updateLabel(): void {
    const el = document.getElementsByTagName('h2')[0]! as HTMLHeadingElement;
    el.textContent = `Hello from transformed TypeScript!`;
}
