import {
  STARollDialog
} from '../apps/roll-dialog.js';
import {
  STATaskRoll, STAChallengeRoll
} from '../roll.js';

export class STAActor extends Actor {
  /** Define some max/min statistic values */
  static ATTRIBUTE_MIN = 7;
  static ATTRIBUTE_MAX = 12;
  static DISCIPLINE_MIN = 0;
  static DISCIPLINE_MAX = 5;
  static STRESS_MIN = 0;
  static DETERMINATION_MIN = 0;
  static DETERMINATION_MAX = 3;
  static REPUTATION_MIN = 0;

  /**
   * Fix up the default image, if needed
   * 
   * @param ...args
   * @return void
   */
  prepareBaseData(...args) {
    const ret = super.prepareBaseData(...args);
    if (!this.img) this.img = game.sta.defaultImage;
    return ret;
  }

  /**
   * Set stress and reputation maximums of characters
   * 
   * @param ...args
   * @return void
   */
  prepareDerivedData(...args) {
    const ret = super.prepareDerivedData(...args);

    // TODO: Move to a CharacterActor class
    if (this.type == "character")
    {
      if (!this.system)
        throw new Error("Invalid object supplied");

      // Ensure attribute values aren't over the max/min.
      let attributeSelected = false;
      $.each(this.system.attributes, (key, attribute) => {
        attribute = this.matchWithTemplate('attributes', key, attribute);
        attribute.value = this.setValueWithinRange(attribute.value, STAActor.ATTRIBUTE_MIN, STAActor.ATTRIBUTE_MAX);
        if (attribute.selected && attributeSelected)
          attribute.selected = false;
        else if (attribute.selected)
          attributeSelected = true;
      });
      if (!attributeSelected)
        this.system.attributes.control.selected = true;

      // Ensure discipline values aren't over the max/min.
      let disciplineSelected = false;
      $.each(this.system.disciplines, (key, discipline) => {
        discipline = this.matchWithTemplate('disciplines', key, discipline);
        discipline.value = this.setValueWithinRange(discipline.value, STAActor.DISCIPLINE_MIN, STAActor.DISCIPLINE_MAX)
        if (discipline.selected && disciplineSelected)
          discipline.selected = false;
        else if (discipline.selected)
          disciplineSelected = true;
      });
      if (!disciplineSelected)
        this.system.disciplines.command.selected = true;

      // Check stress max/min
      this.system.stress = this.matchWithTemplate('stress', this.system.stress);

      // Set stress maximum
      this.system.stress.max = Number(this.system.attributes.fitness.value) + Number(this.system.disciplines.security.value);
      if (this.items.find(item => item.type == "talent" && item.name  == "Resolute"))
        this.system.stress.max += 3; // TODO: Make non-magic; probably from the item def?
      this.system.stress.value = this.setValueWithinRange(this.system.stress.value, STAActor.STRESS_MIN, this.system.stress.max);

      // Check determination max/min
      this.system.determination = this.matchWithTemplate('determination', this.system.determination);
      this.system.determination.value = this.setValueWithinRange(this.system.determination.value, STAActor.DETERMINATION_MIN, STAActor.DETERMINATION_MAX);

      // Check reputation max/min
      this.system.reputation = this.matchWithTemplate('reputation', this.system.reputation);
      this.system.reputation.max = game.settings.get('sta', 'maxNumberOfReputation');
      this.system.reputation.value = this.setValueWithinRange(this.system.reputation.value, STAActor.REPUTATION_MIN, this.system.reputation.max);
    }
    return ret;
  }
  
  /**
   * Ensure an indicated statistic matches the template model for it
   * 
   * Accepts two or three arguments. First argument is always the main
   * key for the Actor. Second argument can be a sub-key. Final 
   * argument is always the current data on the actor
   * 
   * @return  object
   */
  matchWithTemplate()
  {
    // Figure out what mode we're in
    let statTemplate;
    let statData;
    let statName; // Diagnostic only
    switch (arguments.length)
    {
      case 3:
      {
        statTemplate = game.template.Actor.character[arguments[0]][arguments[1]];
        statName = arguments[0]+'.'+arguments[1];
        statData = arguments[2];
        break;
      }
      case 2:
      {
        statTemplate = game.template.Actor.character[arguments[0]];
        statName = arguments[0];
        statData = arguments[1];
        break;
      }
      default:
      {
        throw new Error("Insufficient argument count");
        break;
      }
    }

    let newStat = JSON.parse(JSON.stringify(statTemplate));
    if (typeof statData != typeof statTemplate)
    {
      if (!isNaN(statData) && isNaN(statTemplate)) // Did it get turned into a number at some point?
      {
        // Try to preserve the value
        if (newStat.value !== undefined)
          newStat.value = statData;
      }
    }
    for (let prop in statData)
    {
      newStat[prop] = statData[prop];
    }
    return newStat;
  }

  /**
   * Given a statistic value, its minimum value, and its maximum value,
   * return the nearest value within the min/max bounds, including the
   * original value.
   * 
   * @param int value
   * @param int [optional] min
   * @param int [optional] max
   * @return  int
   */
  setValueWithinRange(value, min = 0, max = null)
  {
    value = (!isNaN(max) ? Math.min(value, max) : value);
    return (!isNaN(min) ? Math.max(value, min) : value);
  }
  
  /**
   * If an update includes a change in the "selected" attribute or
   * discipline, ensure the data payload includes properties for all
   * attributes/disciplines, set to false except for the chosen one.
   * 
   * @param {object} data
   * @param {object} context
   * @return  Promise
   */
  async update(data, context)
  {
    if (data['use-attribute'])
    {
      for (const attribute in this.system.attributes)
      {
        data[`system.attributes.${attribute}.selected`] = (attribute == data['use-attribute']);
      }
    }
    if (data['use-discipline'])
    {
      for (const discipline in this.system.disciplines)
      {
        data[`system.disciplines.${discipline}.selected`] = (discipline == data['use-discipline']);
      }
    }
    return super.update(data, context);
  }
  
  /**
   * Perform a task roll
   * 
   * @param string base attribute/system
   * @param string skill discipline/department
   * @return TODO: Determine
   */
  async performTaskRoll(base, skill)
  {
    let actorRef = this;
    let r = new CONFIG.Dice.STATaskRoll(null, null, {
      actor: actorRef,
      base: base,
      skill: skill
    });
    const configured = await r.configureDialog();
    if (configured === null)
      return;
    await r.evaluate({async: true});
/*
 *     const rollData = foundry.utils.mergeObject({
      parts: parts,
      data: data,
      title: `${flavor}: ${this.name}`,
      flavor,
      chooseModifier: true,
      halflingLucky: this.getFlag("dnd5e", "halflingLucky"),
      reliableTalent,
      messageData: {
        speaker: options.speaker || ChatMessage.getSpeaker({actor: this}),
        "flags.dnd5e.roll": {type: "skill", skillId }
      }
    }, options);
    */
    const messageData = mergeObject({
      speaker: ChatMessage.getSpeaker({actor: this}),
    }, r);
    return r.toMessage(messageData);
  }
}

/** Shared functions for actors **/
export class STASharedActorFunctions {
  // This function renders all the tracks. This will be used every time the character sheet is loaded. It is a vital element as such it runs before most other code!
  staRenderTracks(html, stressTrackMax, determinationPointsMax, repPointsMax, shieldsTrackMax, powerTrackMax, crewTrackMax) {
    let i;

    // if this is a starship, it will have shields instead of stress, but will be handled very similarly
    if (shieldsTrackMax) {
      for (i = 0; i < shieldsTrackMax; i++) {
        html.find('[id^="shields"]')[i].classList.add('shields');
        if (i + 1 <= html.find('#total-shields').val()) {
          html.find('[id^="shields"]')[i].setAttribute('data-selected', 'true');
          html.find('[id^="shields"]')[i].classList.add('selected');
        } else {
          html.find('[id^="shields"]')[i].removeAttribute('data-selected');
          html.find('[id^="shields"]')[i].classList.remove('selected');
        }
      }
    }
    // if this is a starship, it will have power instead of determination, but will be handled very similarly
    if (powerTrackMax) {
      for (i = 0; i < powerTrackMax; i++) {
        html.find('[id^="power"]')[i].classList.add('power');
        if (i + 1 <= html.find('#total-power').val()) {
          html.find('[id^="power"]')[i].setAttribute('data-selected', 'true');
          html.find('[id^="power"]')[i].classList.add('selected');
        } else {
          html.find('[id^="power"]')[i].removeAttribute('data-selected');
          html.find('[id^="power"]')[i].classList.remove('selected');
        }
      }
    }
    // if this is a starship, it will also have crew support level instead of determination, but will be handled very similarly
    if (crewTrackMax) {
      for (i = 0; i < crewTrackMax; i++) {
        html.find('[id^="crew"]')[i].classList.add('crew');
        if (i + 1 <= html.find('#total-crew').val()) {
          html.find('[id^="crew"]')[i].setAttribute('data-selected', 'true');
          html.find('[id^="crew"]')[i].classList.add('selected');
        } else {
          html.find('[id^="crew"]')[i].removeAttribute('data-selected');
          html.find('[id^="crew"]')[i].classList.remove('selected');
        }
      }
    }
  }

  // This handles performing an attribute test using the "Perform Check" button.
  async rollAttributeTest(event, selectedAttribute, selectedAttributeValue,
    selectedDiscipline, selectedDisciplineValue, defaultValue, speaker) {
    event.preventDefault();
    if (!defaultValue) defaultValue = 2;
    // This creates a dialog to gather details regarding the roll and waits for a response
    const rolldialog = await STARollDialog.create(true, defaultValue);
    if (rolldialog) {
      const dicePool = rolldialog.get('dicePoolSlider');
      const usingFocus = rolldialog.get('usingFocus') == null ? false : true;
      const usingDetermination = rolldialog.get('usingDetermination') == null ? false : true;
      const complicationRange = parseInt(rolldialog.get('complicationRange'));
      // Once the response has been collected it then sends it to be rolled.
      const staRoll = new STARoll();
      staRoll.performAttributeTest(dicePool, usingFocus, usingDetermination,
        selectedAttribute, selectedAttributeValue, selectedDiscipline,
        selectedDisciplineValue, complicationRange, speaker);
    }
  }

  // This handles performing an challenge roll using the "Perform Challenge Roll" button.
  async rollChallengeRoll(event, weaponName, defaultValue, speaker) {
    event.preventDefault();
    // This creates a dialog to gather details regarding the roll and waits for a response
    const rolldialog = await STARollDialog.create(false, defaultValue);
    if (rolldialog) {
      const dicePool = rolldialog.get('dicePoolValue');
      // Once the response has been collected it then sends it to be rolled.
      const staRoll = new STARoll();
      staRoll.performChallengeRoll(dicePool, weaponName, speaker);
    }
  }

  // This handles performing an "item" roll by clicking the item's image.
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
}
