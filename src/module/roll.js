export class STARoll extends Roll
{
  /**
   * A generic dialog configuration method, which can be modified by
   * subclasses to supply roll-type-specific data. Uses the template
   * configured in each subclass.
   *
   * @param object options
   * @return  STARoll (or subclass thereof)
   */
  async configureDialog(options)
  {
    if (!this.templateDialog)
    {
      ui.notifications.error("Cannot present a roll dialog without a template defined");
      return;
    }

    const content = await renderTemplate(
      this.templateDialog,
      mergeObject(
        {
          'defaultValue': null
        },
        options
      )
    );

    // Create a new promise for the HTML above.
    return new Promise(resolve => {
      new Dialog({
        title: game.i18n.localize('sta.apps.dicepoolwindow'),
        content: content,
        buttons: {
          roll: {
            label: game.i18n.localize('sta.apps.rolldice'),
            callback: (html) => resolve(this._onDialogSubmit(html))
          }
        },
        default: 'roll',
        close: () => resolve(null)
      }, options).render(true);
    });
  }

  /**
   * Handle submission of the Roll evaluation configuration Dialog
   *
   * @param {jQuery} html         The submitted dialog content
   */
  _onDialogSubmit(html)
  {
    return this;
  }

  /**
   * Wrapper around Roll.evaluate that allows us to bypass the need to
   * specify async: true, which will eventually become the default
   * anyway
   *
   * @param mixed ...args
   * @return STARoll
   */
  evaluate(...args)
  {
    if (this._evaluated)
      return this;
    return super.evaluate({minimize: false, maximize: false, async: true})
  }

  /**
   * @override
   */
  async render({flavor='', template=this.constructor.CHAT_TEMPLATE, isPrivate=false}={})
  {
    if (!this._evaluated) await this.evaluate();

    const baseChatData = await this._getBaseChatData(flavor);
    if (isPrivate)
    {
      baseChatData.isPrivate = isPrivate;
      baseChatData.formula = "???";
      baseChatData.tooltip = "";
      baseChatData.total = "?";
    }

    const templateData = await this._populateTemplateParams();

    const mergedData = mergeObject(baseChatData, templateData);
    return await renderTemplate(template, mergedData); // TODO: handle isPrivate
  }

  /**
   * Get default chat data pertinent to any sort of roll
   *
   * @param string flavor
   * @param boolean isPrivate
   * @return  object
   */
  async _getBaseChatData(flavor = '')
  {
    if (!this._evalauted) await this.evaluate();
    return {
      formula: this._formula,
      user: game.user.id,
      flavor: flavor,
      tooltip: await this.getTooltip(),
      total: Math.round(this.total * 100) / 100,
      speaker: this.options.speaker || ChatMessage.getSpeaker({actor: this.options.actor})
    };
  }

  /**
   * @override
   */
  async toMessage(messageData={}, {rollMode, create=true}={})
  {
    rollMode = this.options.rollMode || game.settings.get("core", "rollMode");
    return await super.toMessage(messageData, {rollMode: rollMode, create: create});
  }
}

export class STATaskRoll extends STARoll
{
  static ROLL_FORMULA = '(@dicePool)d20cf>=(@complication)cs<=(@target)';
  static DEFAULT_DICE_NUMBER = 2;
  static DEFAULT_COMPLICATION_RANGE = 1;
  static TEMPLATE_DIALOG = 'systems/sta/templates/apps/dicepool-attribute.html';
  static CHAT_TEMPLATE = 'systems/sta/templates/chat/roll-task.html';

  /**
   * We ignore formula and data, constructing them ourselves from
   * options, but we need to preserve the funcsig for all the other
   * stuff that uses it.
   *
   * @param string formula
   * @param object data
   * @param object options
   * @return ...
   */
  constructor(formula, data, options)
  {
    // If we were called blind, give us some safety
    if (typeof options != 'object')
      options = {};

    if (!options.dicePool)
      options.dicePool = STATaskRoll.DEFAULT_DICE_NUMBER;
    if (!options.target)
      options.target = 1;
    if (!options.complicationRange)
      options.complicationRange = STATaskRoll.DEFAULT_COMPLICATION_RANGE;
    if (!options.useFocus)
      options.useFocus = false;
    if (!options.useDetermination)
      options.useDetermination = false;
    if (!options.actor)
      throw new Error("Actor must be supplied");

    const ret = super(STATaskRoll.ROLL_FORMULA, {
        dicePool: options.dicePool,
        target: options.target,
        complication: STATaskRoll.getComplicationThreshold(options.complicationRange)
      },
      options
    );

    this.templateDialog = this.constructor.TEMPLATE_DIALOG;
    this.templateResult = this.constructor.CHAT_TEMPLATE;
    this.options = options;
    return ret;
  }

  /**
   * Recreate a Roll instance using a provided data object
   * @param {object} data   Unpacked data representing the Roll
   * @returns {Roll}         A reconstructed Roll instance
   */
  static fromData(data) {
    if (!data.data)
    {
      data.data = {
        dicePool: data.options?.dicePool,
        target: data.options?.target,
        complication: data.options?.complicationRange
      };
    }
    return super.fromData(data);
  }

  /**
   * Given a value representing the complication range (i.e. 1, 2, 3),
   * convert that into a "failure" roll on the actual die result.
   *
   * @param int complicationRange
   * @return int
   */
  static getComplicationThreshold(complicationRange)
  {
    return (21 - (Number(complicationRange) || STATaskRoll.DEFAULT_COMPLICATION_RANGE));
  }

  /**
   * Basic wrapper around configureDialog
   *
   * @param object options
   * @return  STATaskRoll
   */
  async configureDialog(options)
  {
    if (typeof options != 'object')
      options = {};
    options = mergeObject(this.options, options);

    // Mix in our own ID for this dialog based on the requesting actor,
    // to prevent duplicates
    options.id = 'STATaskRoll';
    return await super.configureDialog(options);
  }

  /**
   * Getter for an instance's complication threshold
   *
   * @return  int
   */
  get complicationThreshold()
  {
    return STATaskRoll.getComplicationThreshold(this.options.complicationRange);
  }

  /**
   * Callback for what to do when the dice roll dialog is submitted
   *
   * @param object html
   * @return  STATaskRoll
   */
  _onDialogSubmit(html)
  {
    this.options.rollMode = game.settings.get("core", "rollMode");
    const form = html[0].querySelector("form");

    // Update our options with information derived from the form data
    this.options.dicePool = Number(form.dicePoolSlider.value);
    let baseValue = 0;
    let skillValue = 0;
    if (this.options.actor.type == 'character')
    {
      baseValue = Number(this.options.actor?.system?.attributes[this.options.base]?.value);
      skillValue = Number(this.options.actor?.system?.disciplines[this.options.skill]?.value);
    }
    else
    {
      baseValue = Number(this.options.actor?.system?.systems[this.options.base]?.value);
      skillValue = Number(this.options.actor?.system?.departments[this.options.skill]?.value);
    }
    this.options.target = baseValue + skillValue;
    this.options.criticalThreshold = 1;
    if (form.usingFocus.checked)
    {
      this.options.useFocus = true;
      this.options.criticalThreshold = skillValue;
    }
    this.options.complicationRange = Number(form.complicationRange.value) || this.options.complicationRange;
    this.options.useDetermination = Boolean(form.usingDetermination.checked);

    // Regenerate some of our central assumptions now
    this.data = this._prepareData({dicePool: this.options.dicePool, target: this.options.target, complication: this.complicationThreshold});
    this.terms = this.constructor.parse(STATaskRoll.ROLL_FORMULA, this.data, this.options);
    this._dice = [];
    this._formula = this.constructor.getFormula(this.terms);

    return this;
  }

  /**
   * Extension of normal Roll behavior to do the necessary computation
   * for evaluating the result of a Task roll
   *
   * @param mixed ...args
   * @return STATaskRoll
   */
  async _evaluate(...args)
  {
    // Compute!
    await super._evaluate(...args);

    // Now give the dice terms some help.
    for (let t of this.terms)
    {
      for (let r of t.results)
      {
        if (r.result <= this.options.criticalThreshold)
        {
          r.count += 1;
          r.critical = true;
        }
        else
          r.critical = false;
        // TODO: Handle (optional) multiple complications
      }
    }

    // If determination was involved, insert another pre-computed result
    if (this.options.useDetermination)
    {
      // TODO: Automatically debit Determination from character? (not here, though)
      this.terms[0].number += 1;
      this.terms[0].results.push({result: 1, active: true, count: 2, success: true, determination: true});
    }

    // Re-evaluate the total
    this._total = this._evaluateTotal();

    return this;
  }

  /**
   * Extend behavior of parent STARoll class
   *
   * @return  object
   */
  async _getBaseChatData(flavor = '')
  {
    const baseChatData = await super._getBaseChatData(flavor);
    switch (this.options.actor.type)
    {
      case 'character':
        baseChatData.flavor = game.i18n.format('sta.actor.character.attribute.' + this.options.base) + ' ' + game.i18n.format('sta.actor.character.discipline.' + this.options.skill) + ' ' + game.i18n.format('sta.roll.task.name');
        break;
      default:
        baseChatData.flavor = game.i18n.format('sta.actor.starship.system.' + this.options.base) + ' ' + game.i18n.format('sta.actor.starship.department.' + this.options.skill) + ' ' + game.i18n.format('sta.roll.task.name');
        break;
    }
    return baseChatData;
  }

  /**
   * Populate all of the parameters our chat template needs to display
   * roll results properly
   *
   * @return object
   */
  async _populateTemplateParams()
  {
    if (!this._evaluated) await this.evaluate();
    const templateParams = {
      useDetermination: this.options.useDetermination,
      criticalThreshold: this.options.criticalThreshold,
      target: this.options.target,
      complicationThreshold: this.complicationThreshold,
      dicePool: this.terms[0]?.results,
      successes: (this.terms[0]?.results?.filter(die => die.success)?.map(die => die.count)?.reduce((a,b) => a + b,0) || 0),
      numComplications: (this.terms[0]?.results?.filter(die => die.falure)?.length || 0),
      actor: this.options.actor,
      selectedBase: this.options.base,
      selectedSkill: this.options.skill,
      speakerId: ''
    };

    // Handle multiple complication setting
    const multipleComplicationsAllowed = game.settings.get('sta', 'multipleComplications');
    if (!multipleComplicationsAllowed && templateParams.numComplications > 1)
      templateParams.numComplications = 1;

    return templateParams;
  }

  /**
   * @override
   */
  async toMessage(messageData={}, {rollMode, create=true}={})
  {
    const baseChatData = await this._getBaseChatData();
    const taskData = await this._populateTemplateParams();
    messageData = mergeObject(baseChatData, taskData, messageData);
    return super.toMessage(messageData, {rollMode: rollMode, create: create});
  }
}

/**
 * This roll type corresponds to a challenge roll, such as when rolling
 * damage for a weapon.
 */
export class STAChallengeRoll extends STARoll
{
  static ROLL_FORMULA = '(@dicePool)d6';
  static DEFAULT_DICE_NUMBER = 2;
  static TEMPLATE_DIALOG = 'systems/sta/templates/apps/dicepool-challenge.html';
  static CHAT_TEMPLATE = 'systems/sta/templates/chat/roll-challenge.html';

  constructor(formula, data, options)
  {
    // If we were called blind, give us some safety
    if (typeof options != 'object')
      options = {};

    if (!options.actor)
      throw new Error("Actor must be supplied");

    /**
     * Determine default dice pool size
     */
    options.dicePool = STAChallengeRoll.DEFAULT_DICE_NUMBER;
    options.rollTitle = "";
    if (options.itemData)
    {
      let isWeapon = false;
      let addDamage = 0;
      switch (options.actor.type)
      {
        case 'character':
          if (options.itemData?.itemType == 'characterweapon')
          {
            isWeapon = true;
            addDamage = options.actor.system.disciplines.security.value;
          }
          break;
        case 'starship': // some kind of ship
        case 'smallcraft':
          if (options.itemData?.itemType == 'starshipweapon')
          {
            isWeapon = true;
            addDamage = options.actor.system.departments.security.value;
          }
          break;
        default: // Extended Task
          break;
      }
      if (isWeapon)
      {
        options.dicePool = Number(options.itemData.itemDamage) + Number(addDamage);
        options.rollTitle = options.itemData.itemValue;
      }
    }

    const ret = super(STAChallengeRoll.ROLL_FORMULA, {
        dicePool: options.dicePool
      },
      options
    );

    this.templateDialog = this.constructor.TEMPLATE_DIALOG;
    this.templateResult = this.constructor.CHAT_TEMPLATE;
    this.options = options;
    return ret;
  }

  /**
   * Recreate a Roll instance using a provided data object
   * @param {object} data   Unpacked data representing the Roll
   * @returns {Roll}         A reconstructed Roll instance
   */
  static fromData(data) {
    if (!data.data)
    {
      data.data = {
        dicePool: data.options?.dicePool
      };
    }
    return super.fromData(data);
  }

  /**
   * Basic wrapper around configureDialog
   *
   * @param object options
   * @return  STATaskRoll
   */
  async configureDialog(options)
  {
    if (typeof options != 'object')
      options = {};
    options = mergeObject(this.options, options);

    // Mix in our own ID for this dialog based on the requesting actor,
    // to prevent duplicates
    options.id = 'STAChallengeRoll';
    return await super.configureDialog(options);
  }

  /**
   * Callback for what to do when the dice roll dialog is submitted
   *
   * @param object html
   * @return  STATaskRoll
   */
  _onDialogSubmit(html)
  {
    this.options.rollMode = game.settings.get("core", "rollMode");
    const form = html[0].querySelector("form");

    // Update our options with information derived from the form data
    this.options.dicePool = Number(form.dicePoolValue.value);

    // Regenerate some of our central assumptions now
    this.data = this._prepareData({dicePool: this.options.dicePool});
    this.terms = this.constructor.parse(STAChallengeRoll.ROLL_FORMULA, this.data, this.options);
    this._dice = [];
    this._formula = this.constructor.getFormula(this.terms);

    return this;
  }

  /**
   * Extension of normal Roll behavior to do the necessary computation
   * for evaluating the result of a Task roll
   *
   * @param mixed ...args
   * @return STAChallengeRoll
   */
  async _evaluate(...args)
  {
    // Compute!
    await super._evaluate(...args);

    // Now give the dice terms some help.
    let successes = 0;
    for (let t of this.terms)
    {
      t.results = this.addResultDetails(t.results);
      for (let r of t.results)
      {
        if (r.success)
        {
          successes += r.count;
        }
      }
    }

    // Re-evaluate the total
    this._total = successes;

    return this;
  }

  /**
   * Extend behavior of parent STARoll class
   *
   * @return  object
   */
  async _getBaseChatData(flavor = '')
  {
    const baseChatData = await super._getBaseChatData(flavor);
    switch (this.options.actor.type)
    {
      case 'character':
      case 'starship':
      case 'smallcraft':
        baseChatData.flavor = this.options?.rollTitle || this.options.itemData?.itemValue || game.i18n.format('sta.apps.defaultchallengetext');
        break;
      default:
        baseChatData.flavor = game.i18n.format('sta.apps.defaultchallengetext');
        break;
    }
    return baseChatData;
  }

  /**
   * Populate all of the parameters our chat template needs to display
   * roll results properly
   *
   * @return object
   */
  async _populateTemplateParams()
  {
    if (!this._evaluated) await this.evaluate();
    const templateParams = {
      rollTitle: this.options.rollTitle,
      dicePool: this.terms[0]?.number,
      diceResults: this.addResultDetails(this.terms[0]?.results),
      successes: (this.terms[0]?.results?.filter(die => die.success)?.map(die => die.count)?.reduce((a,b) => a + b, 0) || 0),
      effects: (this.terms[0]?.results?.filter(die => die.effect)?.map(die => 1)?.reduce((a, b) => a + b, 0) || 0),
      actor: this.options.actor,
      speakerId: ''
    };

    return templateParams;
  }

  /**
   * Adds additional properties to die roll results
   *
   * @param {array} results
   * @return {array}
   */
  addResultDetails(results)
  {
    for (let r of results)
    {
      if (r.result == 1)
      {
        r.success = true;
        r.count = 1;
      }
      else if (r.result == 2)
      {
        r.success = true;
        r.count = 2;
      }
      else if (r.result == 5 || r.result == 6)
      {
        r.success = true;
        r.count = 1;
        r.effect = true;
      }
    }
    return results;
  }

  /**
   * @override
   */
  async toMessage(messageData={}, {rollMode, create=true}={})
  {
    const baseChatData = await this._getBaseChatData();
    const challengeData = await this._populateTemplateParams();
    messageData = mergeObject(baseChatData, challengeData, messageData);
    return super.toMessage(messageData, {rollMode: rollMode, create: create});
  }
}

/*
  async performItemRoll(item, speaker) {
    // Create variable div and populate it with localisation to use in the HTML.
    const variablePrompt = game.i18n.format('sta.roll.item.quantity');
    const variable = `<div class='dice-formula'> `+variablePrompt.replace('|#|', item.system.quantity)+`</div>`;

    // Send the divs to populate a HTML template and sends to chat.
    this.genericItemTemplate(item.img, item.name,
      item.system.description, variable, null)
      .then((html)=>this.sendToChat(speaker, html));
  }

  async performTalentRoll(item, speaker) {
    // Send the divs to populate a HTML template and sends to chat.
    console.log("Performing talent roll [actual]");
    this.genericItemTemplate(item.img, item.name,
      item.system.description, null)
      .then((html)=>this.sendToChat(speaker, html));
  }

  async performFocusRoll(item, speaker) {
    // Send the divs to populate a HTML template and sends to chat.
    this.genericItemTemplate(item.img, item.name,
      item.system.description, null)
      .then((html)=>this.sendToChat(speaker, html));
  }

  async performValueRoll(item, speaker) {
    // Send the divs to populate a HTML template and sends to chat.
    this.genericItemTemplate(item.img, item.name,
      item.system.description, null)
      .then((html)=>this.sendToChat(speaker, html));
  }

  async performInjuryRoll(item, speaker) {
    // Send the divs to populate a HTML template and sends to chat.
    this.genericItemTemplate(item.img, item.name,
      item.system.description, null)
      .then((html)=>this.sendToChat(speaker, html));
  }

  async performWeaponRoll(item, speaker) {
    // Create variable div and populate it with localisation to use in the HTML.
    const variablePrompt = game.i18n.format('sta.roll.weapon.damage');
    const variable = `<div class='dice-formula'> `+variablePrompt.replace('|#|', item.system.damage)+`</div>`;

    // Create dynamic tags div and populate it with localisation to use in the HTML.
    let tags = '';

    if (item.system.qualities.melee) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.melee')+'</div>';
    if (item.system.qualities.ranged) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.ranged')+'</div>';
    if (item.system.qualities.area) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.area')+'</div>';
    if (item.system.qualities.intense) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.intense')+'</div>';
    if (item.system.qualities.knockdown) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.knockdown')+'</div>';
    if (item.system.qualities.accurate) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.accurate')+'</div>';
    if (item.system.qualities.charge) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.charge')+'</div>';
    if (item.system.qualities.cumbersome) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.cumbersome')+'</div>';
    if (item.system.qualities.deadly) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.deadly')+'</div>';
    if (item.system.qualities.debilitating) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.debilitating')+'</div>';
    if (item.system.qualities.grenade) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.grenade')+'</div>';
    if (item.system.qualities.inaccurate) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.inaccurate')+'</div>';
    if (item.system.qualities.nonlethal) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.nonlethal')+'</div>';

    if (item.system.qualities.hiddenx > 0) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.hiddenx') + ' ' + item.system.qualities.hiddenx +'</div>';
    if (item.system.qualities.piercingx > 0) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.piercingx') + ' ' + item.system.qualities.piercingx +'</div>';
    if (item.system.qualities.viciousx > 0) tags += '<div class=\'tag\'> '+game.i18n.format('sta.actor.belonging.weapon.viciousx') + ' ' + item.system.qualities.viciousx +'</div>';


    // Send the divs to populate a HTML template and sends to chat.
    this.genericItemTemplate(item.img, item.name,
      item.system.description, variable, tags)
      .then((html)=>this.sendToChat(speaker, html));
  }

  async performArmorRoll(item, speaker) {
    // Create variable div and populate it with localisation to use in the HTML.
    const variablePrompt = game.i18n.format('sta.roll.armor.protect');
    const variable = `<div class='dice-formula'> `+variablePrompt.replace('|#|', item.system.protection)+`</div>`;

    // Send the divs to populate a HTML template and sends to chat.
    this.genericItemTemplate(item.img, item.name,
      item.system.description, variable, null)
      .then((html)=>this.sendToChat(speaker, html));
  }

  async genericItemTemplate(img, name, description, variable, tags) {
    // Checks if the following are empty/undefined. If so sets to blank.
    const descField = description ? description : '';
    const tagField = tags ? tags : '';
    const varField = variable ? variable : '';

    // Builds a generic HTML template that is used for all items.
    const html = `<div class='sta roll generic'>
                    <div class='dice-roll'>
                      <div class="dice-result">
                        <div class='dice-formula title'>
                          <img class='img' src=`+img+`></img>
                            <div>`+name+`</div>
                          </div>
                        `+varField+`
                        <div class="dice-tooltip">`+descField+`</div>
                          <div class='tags'>
                            `+tagField+`
                          </div>
                        <div>
                      </div>
                    </div>`;

    // Returns it for the sendToChat to utilise.
    return html;
  }

  async sendToChat(speaker, content, roll, flavor) {
    let messageProps = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({actor: speaker}),
      content: content,
      sound: 'sounds/dice.wav'
    };
    if (typeof roll != 'undefined')
      messageProps.roll = roll;
    if (typeof flavor != 'undefined')
      messageProps.flavor = flavor;
      // Send's Chat Message to foundry, if items are missing they will appear as false or undefined and this not be rendered.
      ChatMessage.create(messageProps).then((msg) => {
        return msg;
      });
  }
*/

/*
async rollGenericItem(event, type, id, speaker) {
  event.preventDefault();
  const item = speaker.items.get(id);
  const staRoll = new STARoll();
  // It will send it to a different method depending what item type was sent to it.
  switch (type) {
  case 'item':
    staRoll.performItemRoll(item, speaker);
    break;
  case 'focus':
    staRoll.performFocusRoll(item, speaker);
    break;
  case 'value':
    staRoll.performValueRoll(item, speaker);
    break;
  case 'weapon':
  case 'starshipweapon':
    staRoll.performWeaponRoll(item, speaker);
    break;
  case 'armor':
    staRoll.performArmorRoll(item, speaker);
    break;
  case 'talent':
    staRoll.performTalentRoll(item, speaker);
    break;
  case 'injury':
    staRoll.performInjuryRoll(item, speaker);
    break;
  }
}
*/