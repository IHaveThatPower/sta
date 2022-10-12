import {
  STAActorSheet
} from './actor-sheet.js';

export class STACharacterSheet extends STAActorSheet {
  static SHEET_TEMPLATE = 'systems/sta/templates/actors/character-sheet.html';

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['sta', 'sheet', 'actor', 'character'],
      width: 850,
      height: 910,
    });
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // If the player has limited access to the actor, there is nothing to see here. Return.
    if (!game.user.isGM && this.actor.limited) return;

    this._activateItemEditListeners(html);

    // Hide/show the talent tooltip
    this._handleTalentClick(html);

    // Check if the form is editable; if not, hide control used by the
    // owner, then abort any more of the script.
    if (!this.options.editable)
    {
      this._lockControls(html);
      return;
    };

    // This toggles whether a Value is used or not.
    this._activateValueUseListeners(html);

    // Activate rollable buttons on items
    this._activateRollableListeners(html);

    // Activate listeners for create/destroy items
    this._activateItemCreateListeners(html);
    this._activateItemDeleteListeners(html);

    // Register handlers for when a tracker box is clicked
    this._handleTrackerEvent(html, '[id^="rep"]', '#total-rep', this.object.system.reputation.value);
    this._handleTrackerEvent(html, '[id^="stress"]', '#total-stress', this.object.system.stress.value);
    this._handleTrackerEvent(html, '[id^="determination"]', '#total-determination', this.object.system.determination.value);

    // Listeners related to attributes, disciplines, and rolling
    this._activateActiveStatListeners(html);
    this._activateStatRollListeners(html);
  }
}
