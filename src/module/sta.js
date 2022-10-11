// Import Modules
import {
  STATaskRoll, STAChallengeRoll
} from './roll.js';
import {
  STAActor
} from './actors/actor.js';
import {
  STACharacterSheet
} from './actors/sheets/character-sheet.js';
import {
  STAStarshipSheet
} from './actors/sheets/starship-sheet.js';
import {
  STASmallCraftSheet
} from './actors/sheets/smallcraft-sheet.js';
import {
  STAExtendedTaskSheet
} from './actors/sheets/extended-task-sheet.js';
import {
  STAItemSheet
} from './items/item-sheet.js';
import {
  STACharacterWeaponSheet
} from './items/character-weapon-sheet.js';
import {
  STAStarshipWeaponSheet
} from './items/starship-weapon-sheet.js';
import {
  STAArmorSheet
} from './items/armor-sheet.js';
import {
  STATalentSheet
} from './items/talent-sheet.js';
import {
  STAGenericSheet
} from './items/generic-sheet.js';
import {
  STASmallCraftContainerSheet
} from './items/smallcraftcontainer-sheet.js';
import { 
  STATracker 
} from './apps/tracker.js';
import * as macros from './macro.js';
import { 
  STAItem
} from './items/item.js';
import {
  register_dsn_ufp_themes
} from './dice/dice-so-nice.js';

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

/**
 * Repeat a block from either 0 or 1 to the specified value.
 * 
 * @param  int times      Final number
 * @param  bool includeZero  Whether we start at 0 or 1
 * @return  string
 */
Handlebars.registerHelper('repeat', function ()
{
  if (arguments.length <= 1) // We were only passed the default options
    throw new Error("Must supply at least a number of times to repeat");
  const times = arguments[0];
  const includeZero = (arguments.length == 3) ? arguments[1] : false;
  const options = arguments[arguments.length - 1];
  let data = {};
  if (options.data)
    data = Handlebars.createFrame(options.data);
  
  let content = [];
  let i = includeZero ? 0 : 1;
  for (i; i <= times; i++)
  {
    if (data)
    {
      data.index = i;
    }
    content.push(options.fn(i, {data: data}));
  }
  return content.join('');
});

/**
 * Add two numbers together
 * 
 * @param  float num1    First Number
 * @param  float num2    Second number
 * @return  float
 */
Handlebars.registerHelper('add', function (num1, num2)
{
  if (isNaN(Number(num1)))
    num1 = 0;
  if (isNaN(Number(num2)))
    num2 = 0;
  return (Number(num1) + Number(num2));
});

/**
 * Replace an instance of a string with another string
 * 
 * @param string haystack
 * @param string needle
 * @param string replacement
 * @return string
 */
Handlebars.registerHelper('replace', function (haystack, needle, replacement)
{
  return haystack.replace(needle, replacement);
});

Hooks.once('init', function() {
  let versionInfo = game.world.coreVersion;
  // Splash Screen
  console.log(`Initializing Star Trek Adventures Tabletop Roleplaying Game System
                 .
                .:.
               .:::.
              .:::::.
          ***.:::::::.***
     *******.:::::::::.*******       
   ********.:::::::::::.********     
  ********.:::::::::::::.********    
  *******.::::::'***\`::::.*******    
  ******.::::'*********\`::.******    
   ****.:::'*************\`:.****
     *.::'*****************\`.*
     .:'  ***************    .
    .`);
  /**
   * ` /**
   **/


  // Create a namespace within the game global
  game.sta = {
    applications: {
      STACharacterSheet,
      STAStarshipSheet,
      STASmallCraftSheet,
      STAExtendedTaskSheet,
      STAItemSheet,
      STACharacterWeaponSheet,
      STAStarshipWeaponSheet,
      STAArmorSheet,
      STATalentSheet,
      STAGenericSheet,
      STASmallCraftContainerSheet,
      STAItem,
    },
    entities: {
      STAActor,
    },
    macros: macros,
    attributeTest: macros.attributeTest,
    defaultImage: 'systems/sta/assets/icons/voyagercombadgeicon.svg'
  };

  // Define initiative for the system.
  CONFIG.Combat.initiative = {
    formula: '@disciplines.security.value',
    decimals: 0
  };

  // Set up custom challenge dice
  // CONFIG.sta.CHALLENGE_RESULTS = {
  //     1: { label: `<img src='systems/sta/assets/icons/ChallengeDie_Success1.svg'/>`, success: 1, effect: 0 },
  //     2: { label: `<img src='systems/sta/assets/icons/ChallengeDie_Success2.svg'/>`, success: 2, effect: 0 },
  //     3: { label: `<img src='systems/sta/assets/icons/ChallengeDie_Success0.svg'/>`, success: 0, effect: 0 },
  //     4: { label: `<img src='systems/sta/assets/icons/ChallengeDie_Success0.svg'/>`, success: 0, effect: 0 },
  //     5: { label: `<img src='systems/sta/assets/icons/ChallengeDie_Effect.svg'/>`, success: 1, effect: 1 },
  //     6: { label: `<img src='systems/sta/assets/icons/ChallengeDie_Effect.svg'/>`, success: 1, effect: 1 },
  //   };

  // Define custom Entity classes
  CONFIG.Actor.documentClass = STAActor;
  CONFIG.Item.documentClass = STAItem;
  
  // Define custom Roll classes
  CONFIG.Dice.STATaskRoll = STATaskRoll;
  CONFIG.Dice.STAChallengeRoll = STAChallengeRoll;

  // Register Roll Extensions
  CONFIG.Dice.rolls.push(STATaskRoll);
  CONFIG.Dice.rolls.push(STAChallengeRoll);

  // Register sheet application classes
  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('sta', STACharacterSheet, {
    types: ['character'],
    makeDefault: true
  });
  Actors.registerSheet('sta', STAStarshipSheet, {
    types: ['starship']
  });
  Actors.registerSheet('sta', STASmallCraftSheet, {
    types: ['smallcraft'],
  });
  Actors.registerSheet('sta', STAExtendedTaskSheet, {
    types: ['extendedtask']
  });
  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('sta', STAItemSheet, {
    types: ['item'],
    makeDefault: true
  });
  Items.registerSheet('sta', STACharacterWeaponSheet, {
    types: ['characterweapon'],
  });
  Items.registerSheet('sta', STAStarshipWeaponSheet, {
    types: ['starshipweapon'],
  });
  Items.registerSheet('sta', STAArmorSheet, {
    types: ['armor'],
  });
  Items.registerSheet('sta', STATalentSheet, {
    types: ['talent'],
  });
  Items.registerSheet('sta', STAGenericSheet, {
    types: ['value'],
  });
  Items.registerSheet('sta', STAGenericSheet, {
    types: ['focus'],
  });
  Items.registerSheet('sta', STAGenericSheet, {
    types: ['injury'],
  });
  Items.registerSheet('sta', STASmallCraftContainerSheet, {
    types: ['smallcraftcontainer'],
  });

  // Register system settings
  game.settings.register('sta', 'multipleComplications', {
    name: 'Multiple Complications:',
    hint: 'The rulebook states "Any die which rolled 20 causes a complication". This is slightly unclear and as of Version 8 of the PDF, this is still not clear - likely due to the incredible rarity. Enabling this will allow roles to display "There were x Complications" if multiple 20s are rolled. Disabling will just state a single complication.',
    scope: 'world',
    type: Boolean,
    default: true,
    config: true
  });

  game.settings.register('sta', 'threatPermissionLevel', {
    name: 'Threat Tracker User Role:',
    hint: 'Who should be allowed to amend the threat tracker?',
    scope: 'world',
    type: String,
    default: 'ASSISTANT',
    config: true,
    choices: {
      'PLAYER': 'Players',
      'TRUSTED': 'Trusted Players',
      'ASSISTANT': 'Assistant Gamemaster',
      'GAMEMASTER': 'Gamemasters',
    }
  });

  game.settings.register('sta', 'momentumPermissionLevel', {
    name: 'Momentum Tracker User Role:',
    hint: 'Who should be allowed to amend the momentum tracker?',
    scope: 'world',
    type: String,
    default: 'PLAYER',
    config: true,
    choices: {
      'PLAYER': 'Players',
      'TRUSTED': 'Trusted Players',
      'ASSISTANT': 'Assistant Gamemaster',
      'GAMEMASTER': 'Gamemasters',
    }
  });

  game.settings.register('sta', 'maxNumberOfReputation', {
    name: 'Maximum amount of Reputation:',
    hint: 'Max number of reputation that can be given to a character. 20 is default.',
    scope: 'world',
    type: Number,
    default: 20,
    config: true
  });
    
  game.settings.register('sta', 'threat', {
    scope: 'world',
    type: Number,
    default: 0,
    config: false
  });

  game.settings.register('sta', 'momentum', {
    scope: 'world',
    type: Number,
    default: 0,
    config: false
  });
});

Hooks.on('renderChatLog', function(app, html, data) {
  html.on('click', '.reroll-result.task', function(ev) {
    ev.preventDefault();
    let actor;
    let selectedBase;
    let selectedSkill;
    let speakerId;
    // Gather properties
    for (let c of ev.currentTarget.childNodes)
    {
      if (c.nodeName?.toLowerCase() == 'input')
      {
        switch (c.id)
        {
          case 'actor':
            actor = game.actors.get(c.value);
            break;
          case 'selectedBase':
            selectedBase = c.value;
            break;
          case 'selectedSkill':
            selectedSkill = c.value;
            break;
          case 'speakerId':
            speakerId = c.value;
            break;
          default:
            break;
        }
      }
    }
    if (!!actor && !speakerId) // No speaker, assume actor
      speakerId = actor._id;
    if (actor && selectedBase && selectedSkill)
    {
      return actor.performTaskRoll(selectedBase, selectedSkill);
    }
    else
      ui.notifications.warning("Insufficient data to reroll");
  });
});

// Fix old-style reputation
Hooks.once('ready', function() {
  for (const actor of game.actors.filter(actor => actor.type == 'character'))
  {
    if (!isNaN(Number(actor.system.reputation)))
    {
      const currentRep = actor.system.reputation;
      actor.system.reputation = {
        'value': currentRep,
        'min': 0,
        'max': game.settings.get('sta', 'maxNumberOfReputation')
      };
    }
  }
});

Hooks.on('ready', function() {
  const t = new STATracker();
  renderTemplate('systems/sta/templates/apps/tracker.html').then((html) => {
    t.render(true);
  });
});

Hooks.once("diceSoNiceReady", (dice3d) => {
  register_dsn_ufp_themes(dice3d);
});