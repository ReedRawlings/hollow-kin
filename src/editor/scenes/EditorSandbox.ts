// You can write more code here

/* START OF COMPILED CODE */

import Phaser from 'phaser';
/* START-USER-IMPORTS */
/* END-USER-IMPORTS */

export default class EditorSandbox extends Phaser.Scene {
  constructor() {
    super('EditorSandbox');

    /* START-USER-CTR-CODE */
    // Write your code here.
    /* END-USER-CTR-CODE */
  }

  editorCreate(): void {
    const editorSandboxLabel = this.add.text(480, 320, '', {});
    editorSandboxLabel.setOrigin(0.5, 0.5);
    editorSandboxLabel.text = 'EDITOR SANDBOX';
    editorSandboxLabel.setStyle({
      align: 'center',
      color: '#f5f0b8',
      fontFamily: 'Silkscreen, monospace',
      fontSize: '16px',
    });

    this.events.emit('scene-awake');
  }

  /* START-USER-CODE */

  create(): void {
    this.editorCreate();
  }

  /* END-USER-CODE */
}

/* END OF COMPILED CODE */

// You can write more code here
