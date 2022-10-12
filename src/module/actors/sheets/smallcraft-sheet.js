import {
  STAActorSheet
} from './actor-sheet.js';

export class STASmallCraftSheet extends STAActorSheet {
  static SHEET_TEMPLATE = 'systems/sta/templates/actors/smallcraft-sheet.html';

  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['sta', 'sheet', 'actor', 'smallcraft'],
      width: 900,
      height: 735,
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

    // Activate rollable buttons on items
    this._activateRollableListeners(html);

    // Activate listeners for create/destroy items
    this._activateItemCreateListeners(html);
    this._activateItemDeleteListeners(html);

    // Register handlers for when a tracker box is clicked
    this._handleTrackerEvent(html, '[id^="shields"]', '#total-shields', this.object.system.shields.value);
    this._handleTrackerEvent(html, '[id^="power"]', '#total-power', this.object.system.power.value);

    // Listeners related to systems, departments, and rolling
    this._activateActiveStatListeners(html);
    this._activateStatRollListeners(html);
  }
}
