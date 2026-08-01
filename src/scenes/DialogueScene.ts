import Phaser from 'phaser';
import { gameState } from '../managers/GameState';
import { garyDialoguePages, DialoguePage } from '../data/garyDialogue';
import { GaryDialogueEventId } from '../systems/Relationships';
import {
  UI, BODY_FONT, DISPLAY_FONT, button, footer, header, panel, screenFrame,
} from '../ui/Theme';

export class DialogueScene extends Phaser.Scene {
  private eventId: GaryDialogueEventId = 'gary_intro';
  private returnScene = 'TownScene';
  private pages: DialoguePage[] = [];
  private pageIndex = 0;
  private onEnter = () => this.advance();

  constructor() {
    super({ key: 'DialogueScene' });
  }

  init(data: { eventId: GaryDialogueEventId; returnScene?: string }): void {
    this.eventId = data.eventId;
    this.returnScene = data.returnScene ?? 'TownScene';
    this.pageIndex = 0;
    this.pages = garyDialoguePages(
      this.eventId,
      gameState.playerName,
      gameState.garyRelationship(),
      gameState.lastRunSummary,
    );
  }

  create(): void {
    this.input.keyboard?.off('keydown-ENTER', this.onEnter);
    this.input.keyboard?.on('keydown-ENTER', this.onEnter);
    this.draw();
  }

  dialogueState(): object {
    return { eventId: this.eventId, page: this.pageIndex + 1, pages: this.pages.length };
  }

  private draw(): void {
    this.children.removeAll(true);
    const page = this.pages[this.pageIndex];
    screenFrame(this);
    header(this, 'AT THE GATE', 'GARY THE GATEKEEPER', `BOND ${gameState.garyRelationship().stage}/5`, UI.goldCss);
    panel(this, 480, 300, 820, 382, true);
    this.add.rectangle(136, 270, 154, 220, UI.plate).setStrokeStyle(3, UI.gold);
    this.add.text(136, 270, 'G', {
      fontFamily: DISPLAY_FONT, fontSize: '44px', color: UI.goldCss,
    }).setOrigin(0.5);
    this.add.text(250, 160, page.speaker, {
      fontFamily: DISPLAY_FONT, fontSize: '12px', color: UI.hi,
    });
    this.add.text(250, 208, page.text, {
      fontFamily: BODY_FONT, fontSize: '15px', color: UI.body,
      lineSpacing: 10, wordWrap: { width: 580 },
    });
    if (page.choices?.length) {
      page.choices.forEach((choice, index) => {
        button(this, 410 + index * 260, 438, 236, 48, choice, () => this.advance(), UI.gold);
      });
    } else {
      button(this, 760, 438, 180, 48, this.pageIndex === this.pages.length - 1 ? 'FINISH' : 'CONTINUE',
        () => this.advance(), UI.gold);
    }
    footer(this, 'ENTER CONTINUE', `${this.pageIndex + 1} / ${this.pages.length}`);
  }

  private advance(): void {
    if (this.pageIndex < this.pages.length - 1) {
      this.pageIndex += 1;
      this.draw();
      return;
    }
    gameState.completeGaryDialogue(this.eventId);
    gameState.saveToLocalStorage();
    this.scene.start(this.returnScene);
  }
}
