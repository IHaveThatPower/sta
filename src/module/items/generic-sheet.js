export class STAGenericSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['sta', 'sheet', 'item', 'focus', 'value', 'injury'],
      width: 500,
      height: 100,
      tabs: [{navSelector: '.sheet-tabs', contentSelector: '.sheet-body', initial: 'description'}]
    });
  }

  /* -------------------------------------------- */

  // If the player is not a GM and has limited permissions - send them to the limited sheet, otherwise, continue as usual.
  /** @override */
  get template() {
    if ( !game.user.isGM && this.item.limited) {
      ui.notifications.warn('You do not have permission to view this item!');
      return;
    }
    return `systems/sta/templates/items/generic-sheet.html`;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    const data = this.object;
    data.dtypes = ['String', 'Number', 'Boolean'];

    return data;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find('.sheet-body');
    const bodyHeight = position.height - 192;
    sheetBody.css('height', bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    const thisSheet = this;
    html.find('input[name="name"]').on('keyup', function(e) {
      if (!e) e = window.event;
      let keyCode = e.code || e.key;
      if (keyCode == 'Enter') {
        thisSheet.close();
      }
    });
  }
}
