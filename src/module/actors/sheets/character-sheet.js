// import {STASharedActorFunctions} from '../actor.js';

export class STACharacterSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ['sta', 'sheet', 'actor', 'character'],
      width: 850,
      height: 910,
      dragDrop: [{
        dragSelector: '.item-list .item',
        dropSelector: null
      }]
    });
  }

  // If the player is not a GM and has limited permissions - send them to the limited sheet, otherwise, continue as usual.
  /** @override */
  get template() {
    if (!game.user.isGM && this.actor.limited) return 'systems/sta/templates/actors/limited-sheet.html';
    return `systems/sta/templates/actors/character-sheet.html`;
  }

  /** @override */
  async getData(options) {
    const context = super.getData(options);

    for (const item of this.object.items)
    {
      // Checks if items for this actor have default images.
      if (!item.img) item.img = game.sta.defaultImage;
      
      // Prepares item text for display
      await this._prepareTalentTooltips(item);
    }

    // Compatibility shim to support all the templates using system.x
    const sheetData = {...context, ...this.object};
    sheetData.actor = this.object;
    sheetData.items = this.object.items;
    sheetData.system = this.object.system;
    
    return sheetData;
  }
  
  /**
   * getData helper to prepare item tooltips
   * 
   * @param object item
   * @return  void
   */
  async _prepareTalentTooltips(item)
  {
    if (item.type == "talent")
    {
      const fullDescription = item.system.description;
      let tooltip = `${fullDescription}`;
      tooltip = TextEditor.decodeHTML(fullDescription); // Decode to get a more "true" length
      tooltip = TextEditor.truncateText(tooltip, {maxLength: 1000, splitWords: false}); // Truncate to 1000 chars
      tooltip = TextEditor.decodeHTML(fullDescription); // Decode again to remove any invalid characters/tags our truncation introduced
      tooltip = await TextEditor.enrichHTML(tooltip, {'async': true}); // Enrich, adding journal links and the like
      item.sheetTooltip = tooltip; // Assign as unique property we can access
    }
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
  
  /**
   * Subroutine for registering click handlers that deal with opening
   * item sheets
   * 
   * @param object html
   * @return void
   */
  _activateItemEditListeners(html)
  {
    // This allows for each item-edit image to link open an item sheet. This uses Simple Worldbuilding System Code.
    html.find('.control .edit').click((ev) => {
      const li = $(ev.currentTarget).parents('.entry');
      const item = this.actor.items.get(li.data('itemId'));
      item.sheet.render(true);
    });
  }
  
  /**
   * Lock controls, such as when the viewing user doesn't have 
   * edit access to this sheet
   * 
   * @param object html
   * @return  void
   */
   _lockControls(html)
   {
     for (let element of html.find('.check-button, .control.create, .control.delete, .control.toggle, .selector'))
     {
       element.style.display = 'none';
     }
     for (let element of html.find('.box, .rollable'))
     {
       element.classList.add('unset-clickables');
     }
   }
   
   /**
    * Activates listeners for the Value sliders that shows whether or
    * not they have been used.
    * 
    * @param  object html
    * @return void
    */
    _activateValueUseListeners(html)
    {
      html.find('.control.toggle').click(async (ev) => {
        const itemId = ev.currentTarget.closest(".entry").dataset.itemId;
        const item = this.actor.items.get(itemId);
        const state = item.system.used;
        await item.update({"system.used": !state});
        this.render();
      });
    }
    
    /**
     * Makes the buttons next to each item interactable, triggering a
     * roll when clicked
     * 
     * @param object html
     * @return  void
     */
    _activateRollableListeners(html)
    {
      html.find('.rollable, .chat').click((ev) => {
        const itemType = $(ev.currentTarget).parents('.entry')[0].getAttribute('data-item-type');
        const itemId = $(ev.currentTarget).parents('.entry')[0].getAttribute('data-item-id');
        // TODO: Redo how rolls are performed
        const staActor = new STASharedActorFunctions();
        staActor.rollGenericItem(ev, itemType, itemId, this.actor);
      });
    }
    
    /**
     * Allows item-create images to create an item of a type defined 
     * individually by each button.
     * 
     * This uses code found via the Foundry VTT System Tutorial.
     * 
     * @param object html
     * @return  void
     */
    _activateItemCreateListeners(html)
    {
      html.find('.control.create').click(async (ev) => {
        ev.preventDefault();
        const header = ev.currentTarget;
        const type = header.dataset.type;
        const name = `New ${type.capitalize()}`; // TODO: Localize
        const itemData = {
          name: name,
          type: type,
          img: game.sta.defaultImage
        };
        if (type == 'armor')
        {
          itemData.equipped = true;
          for (let item of this.actor.items)
          {
            if (item.type == 'armor' && item.equipped)
            {
              ui.notifications.info('The current actor already had armor equipped. Adding unequipped.'); // TODO: Localize
              itemData.equipped = false;
              break;
            }
          }
        }
        return this.actor.createEmbeddedDocuments("Item", [(itemData)]);
      });
    }

    /**
     * Allows item-delete images to allow deletion of the selected item.
     * This uses Simple Worldbuilding System Code.
     * 
     * @param object html
     * @return  void
     */
    _activateItemDeleteListeners(html)
    {
      html.find('.control .delete').click((ev) => {
        const li = $(ev.currentTarget).parents('.entry');
        if (confirm('Are you sure you want to delete ' + li[0].getAttribute('data-item-value') + '?')) // TODO: Localize
        {
          this.actor.deleteEmbeddedDocuments("Item",[li.data("itemId")]);
          li.slideUp(200, () => this.render(false));
        }
      });
    }    

    /**
     * Handle a tracker-like listener
     * 
     * @param object html             The full Document html
     * @param string clickSelector    The selector to register the handler on
     * @param string  inputSelector   The hidden input that tracks the actual value
     * @param int currentValue        The current value on the actor
     * @return  void
     */
    _handleTrackerEvent(html, clickSelector, inputSelector, currentValue)
    {
      html.find(clickSelector).click(async (ev) => {
        let newTotal = ev.currentTarget?.dataset?.value;
        if (typeof newTotal == 'undefined') // Can't do anything
          return;
        /** 
         * If the one clicked is the same as the current value, treat it
         * as a "turn off" decrement
         */
        if (currentValue == newTotal)
        {
          newTotal -= 1;
        }
        const propertyContainer = html.find(inputSelector)[0];
        propertyContainer.value = newTotal;
        await this.submit();
      });
    }
    
    /**
     * Handle user clicking on a talent to hide/show the talent summary
     * 
     * @param object html
     * @return  void
     */
    _handleTalentClick(html)
    {
      html.find('.talent-tooltip-clickable').click((ev) => {
        const clickedTalentItem = $(ev.currentTarget).closest('li.row.entry');
        const clickedTalentId = clickedTalentItem.data('itemId');
        const clickedTalentTextContainer = clickedTalentItem.siblings('.talent-tooltip-container').filter(function() { return this.dataset?.itemId == clickedTalentId; });

        const currentlyDisplayedTalentElement = $('.talent-tooltip-container:not(.hide)');
        const currentTalentId = currentlyDisplayedTalentElement.data('itemId') || null;

        // If we clicked ourself, hide our container
        if (clickedTalentId == currentTalentId)
        {
          clickedTalentTextContainer.addClass('hide');
        }
        else
        {
          // Hide all others, then show us
          $('.talent-tooltip-container').addClass('hide');
          clickedTalentTextContainer.removeClass('hide');
        }
      });
    }
    
    /**
     * Handle user clicking on an attribute/discipline to make it the
     * chosen "active" one for rolls
     * 
     * @param object html
     * @return void
     */
    _activateActiveStatListeners(html)
    {
      html.find('.stat.row .text.list-entry').click((ev) => {
        try
        {
          let statChosen = $(ev.currentTarget).siblings('input.field').attr('id');
          let statType = $(ev.currentTarget).siblings('input.field').data('statType');
          let statHiddenInput = $('input#use-'+statType);
          statHiddenInput.val(statChosen);
          this.submit();
        }
        catch (error)
        {
          console.error(error);
        }
      });
    }
    
    /**
     * Fire off dice rolls based on elements of the UI that should do so
     * 
     * @param object html
     * @return  void
     */
    _activateStatRollListeners(html)
    {
      html.find('.check-button.attribute').click(async (ev) => {
        const selectedAttribute = html.find('input#use-attribute').val();
        const selectedDiscipline = html.find('input#use-discipline').val();
        return this.actor.performTaskRoll(selectedAttribute, selectedDiscipline);
      });
          
      // If the check-button is clicked it fires the method challenge roll method. See actor.js for further info.
      html.find('.check-button.challenge').click(async (ev) => {
        let r = new STAChallengeRoll();
        await r.evaluate();
        /*
        staActor.rollChallengeRoll(ev, 'Generic', 0, this.actor);
        */
      });

      html.find('.rollable.challenge').click((ev) => {
        /*
        const damage = parseInt(ev.target.parentElement.nextElementSibling.nextElementSibling.innerText) ?
          parseInt(ev.target.parentElement.nextElementSibling.nextElementSibling.innerText) : 0;
        staActor.rollChallengeRoll(ev, ev.target.dataset.itemName, damage, this.actor);
        */
      });

      html.find('.reroll-result').click((ev) => {
        /*
        let selectedAttribute = '';
        let selectedAttributeValue = '';
        let selectedDiscipline = '';
        let selectedDisciplineValue = '';
        for (i = 0; i <= 5; i++) {
          if (html.find('.selector.attribute')[i].checked === true) {
            selectedAttribute = html.find('.selector.attribute')[i].id;
            selectedAttribute = selectedAttribute.slice(0, -9);
            selectedAttributeValue = html.find('#'+selectedAttribute)[0].value;
          }
        }
        for (i = 0; i <= 5; i++) {
          if (html.find('.selector.discipline')[i].checked === true) {
            selectedDiscipline = html.find('.selector.discipline')[i].id;
            selectedDiscipline = selectedDiscipline.slice(0, -9);
            selectedDisciplineValue = html.find('#'+selectedDiscipline)[0].value;
          }
        }
              
        staActor.rollAttributeTest(ev, selectedAttribute,
          parseInt(selectedAttributeValue), selectedDiscipline,
          parseInt(selectedDisciplineValue), null, this.actor);
        */
      });
    }
}
