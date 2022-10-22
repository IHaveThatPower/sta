import {
  STARollDialog
} from '../apps/roll-dialog.js';

export class STAActor extends Actor {
  /** Define some max/min statistic values */
  static BASE_MIN = 7;
  static BASE_MAX = 12;
  static SKILL_MIN = 0;
  static SKILL_MAX = 5;

  /** Character-specific */
  static STRESS_MIN = 0;
  static DETERMINATION_MIN = 0;
  static DETERMINATION_MAX = 3;
  static REPUTATION_MIN = 0;

  /** Starship/Smallcraft-specific */
  static SHIELDS_MIN = 0;
  static POWER_MIN = 0;
  static CREW_MIN = 0;

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
   * Set statistical min/max values for the actor
   *
   * @param ...args
   * @return void
   */
  prepareDerivedData(...args) {
    const ret = super.prepareDerivedData(...args);

    if (!this.system)
      throw new Error("Invalid object supplied");

    switch (this.type)
    {
      case 'character':
        this._prepareDerivedCharacterData();
        break;
      case 'starship':
      case 'smallcraft':
        this._prepareDerivedStarshipData();
        break;
      case 'extendedtask': // TODO: Extended Task
      default:
        break;
    }
    return ret;
  }

  /**
   * Set statistical min/max values specific to characters
   *
   * @return  void
   */
   _prepareDerivedCharacterData()
   {
      // Ensure attribute values aren't over the max/min.
      let attributeSelected = false;
      $.each(this.system.attributes, (key, attribute) => {
        attribute = this.matchWithTemplate('attributes', key, attribute);
        attribute.value = this.setValueWithinRange(attribute.value, STAActor.BASE_MIN, STAActor.BASE_MAX);
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
        discipline.value = this.setValueWithinRange(discipline.value, STAActor.SKILL_MIN, STAActor.SKILL_MAX)
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

  /**
   * Set statistical min/max values relevant to starships/smallcraft
   *
   * @return  void
   */
   _prepareDerivedStarshipData()
   {
      // Ensure attribute values aren't over the max/min.
      let systemSelected = false;
      $.each(this.system.systems, (key, sysData) => {
        sysData = this.matchWithTemplate('systems', key, sysData);
        sysData.value = this.setValueWithinRange(sysData.value, STAActor.BASE_MIN, STAActor.BASE_MAX);
        if (sysData.selected && systemSelected)
          sysData.selected = false;
        else if (sysData.selected)
          systemSelected = true;
      });
      if (!systemSelected)
        this.system.systems.engines.selected = true;

      // Ensure department values aren't over the max/min.
      let departmentSelected = false;
      $.each(this.system.departments, (key, department) => {
        department = this.matchWithTemplate('departments', key, department);
        department.value = this.setValueWithinRange(department.value, STAActor.SKILL_MIN, STAActor.SKILL_MAX)
        if (department.selected && departmentSelected)
          department.selected = false;
        else if (department.selected)
          departmentSelected = true;
      });
      if (!departmentSelected)
        this.system.departments.command.selected = true;

      // Check shield max/min
      this.system.shields = this.matchWithTemplate('shields', this.system.shields);
      this.system.shields.max = Number(this.system.systems.structure.value) + Number(this.system.departments.security.value);
      if (this.items.find(item => item.type == "talent" && item.name  == "Advanced Shields"))
        this.system.shields.max += 5; // TODO: Make non-magic; probably from the item def?
      if (this.type == 'smallcraft')
        this.system.shields.max = Math.ceil(this.system.shields.max / 2);
      this.system.shields.value = this.setValueWithinRange(this.system.shields.value, STAActor.SHIELDS_MIN, this.system.shields.max);

      // Check power max/min
      this.system.power = this.matchWithTemplate('power', this.system.power);
      this.system.power.max = Number(this.system.systems.engines.value);
      if (this.items.find(item => item.type == "talent" && item.name  == "Secondary Reactors"))
        this.system.power.max += 5; // TODO: Make non-magic; probably from the item def?
      if (this.type == 'smallcraft')
        this.system.power.max = Math.ceil(this.system.power.max / 2);
      this.system.power.value = this.setValueWithinRange(this.system.power.value, STAActor.POWER_MIN, this.system.power.max);

      // Check crew max/min
      if (this.type == 'starship') // Not applicable to smallcraft
      {
        this.system.crew = this.matchWithTemplate('crew', this.system.crew);
        this.system.crew.max = Number(this.system.scale);
        // TODO: Handle crew-related talents?
        this.system.crew.value = this.setValueWithinRange(this.system.crew.value, STAActor.CREW_MIN, this.system.crew.max);
      }
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
    const actorTemplate = this.type;
    switch (arguments.length)
    {
      case 3:
      {
        statTemplate = game.template.Actor[actorTemplate][arguments[0]][arguments[1]];
        statName = arguments[0]+'.'+arguments[1];
        statData = arguments[2];
        break;
      }
      case 2:
      {
        statTemplate = game.template.Actor[actorTemplate][arguments[0]];
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
    let baseKey = '';
    let skillKey = '';
    switch (this.type)
    {
      case 'character':
        baseKey = 'attributes';
        skillKey = 'disciplines';
        break;
      default: // TODO: Extended Tasks?
        baseKey = 'systems';
        skillKey = 'departments';
        break;
    }
    if (data['use-base'])
    {
      for (const base in this.system[baseKey])
      {
        data[`system.${baseKey}.${base}.selected`] = (base == data['use-base']);
      }
    }
    if (data['use-skill'])
    {
      for (const skill in this.system[skillKey])
      {
        data[`system.${skillKey}.${skill}.selected`] = (skill == data['use-skill']);
      }
    }
    return super.update(data, context);
  }

  /**
   * Perform a task roll
   *
   * @param string base attribute/system
   * @param string skill discipline/department
   * @return Promise
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

    const messageData = mergeObject({
      speaker: ChatMessage.getSpeaker({actor: this}),
    }, r);
    return r.toMessage(messageData);
  }

  /**
   * Perform a challenge roll
   *
   * @param {object} itemData Optional payload of item data
   * @return Promise
   */
  async performChallengeRoll(itemData = {})
  {
    let actorRef = this;
    let r = new CONFIG.Dice.STAChallengeRoll(null, null, {
      actor: actorRef,
      itemData: itemData
    });
    const configured = await r.configureDialog();
    if (configured === null)
      return;
    await r.evaluate({async: true});

    const messageData = mergeObject({
      speaker: ChatMessage.getSpeaker({actor: this}),
    }, r);
    return r.toMessage(messageData);
  }
}