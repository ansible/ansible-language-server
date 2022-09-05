import Handlebars = require("handlebars");
import * as fs from "fs";
import { SettingsManager } from "../src/services/settingsManager";
import * as path from "path";
import * as _ from "lodash";

// Get the default settings values from settingsManager class
const settingsManager = new SettingsManager(null, null);
const defaultSettings = {
  ansible: settingsManager.defaultSettingsWithDescription,
};

// Convert the nested settings value to single-level object with keys in the form of dotted notations (intermediate step)
const settingsInDotNotation = toDotNotation(defaultSettings);

// Convert the dotted settings value to single-level object with the keys as { settings, defaultValue, description }  (final step)
const arrayOfDefaultSettings = structureSettings(settingsInDotNotation);

// Use handlebars.js to generate doc file with `defaultSettings.handlebars` as template
const TEMPLATE = `
# Language Server Settings

The following are the default values of the settings provided by the Ansible Language Server:

{{#each arrayOfDefaultSettings}}
- **{{setting}}**:
{{#if description}}
{{description}} \\
{{/if}}
{{#ifValueArray valueType}}
{{#each this.defaultValue}}
  - **{{key}}**: {{description}} \\
  _default value:
{{#if defaultValue}}
\`{{defaultValue}}\`_
{{else}}
{{#ifEqualsFalse defaultValue}}
\`false\`_
{{else}}
\`""\`_
{{/ifEqualsFalse}}
{{/if}}
{{/each}}
{{else}}
_default value:
{{#if defaultValue}}
\`{{defaultValue}}\`_
{{else}}
{{#ifEqualsFalse defaultValue}}
\`false\`_
{{else}}
\`""\`_
{{/ifEqualsFalse}}
{{/if}}
{{/ifValueArray}}

{{/each}}
`;

const WARNING_IN_README =
  "<!-- {{! Do not edit this file directly. This is generated by the `generate-settings-readme` npm script }} -->";

const settingsReadmeFileUri = path.join(__dirname, "..", "docs", "settings.md");

// Register a special function for handlebars to deal with comparison of stringed value of false
// Else, normal #if treats it as boolean, even after converting booleans to strings in typescript
Handlebars.registerHelper("ifEqualsFalse", function (arg1, options) {
  // eslint-disable-next-line eqeqeq
  return arg1.toString() === "false" ? options.fn(this) : options.inverse(this);
});

// Register a special function for handlebars to deal with the checking of "list" as value type of settings
Handlebars.registerHelper("ifValueArray", function (arg1, options) {
  // eslint-disable-next-line eqeqeq
  return arg1.toString() === "list" ? options.fn(this) : options.inverse(this);
});

const template = Handlebars.compile(TEMPLATE);
const output = template({ arrayOfDefaultSettings });
fs.writeFileSync(settingsReadmeFileUri, `${WARNING_IN_README}\n${output}`);

console.log(
  `Readme file for settings description and default value generated.`,
);
console.log(`File: ${settingsReadmeFileUri}`);

export function toDotNotation(obj, res = {}, current = "") {
  for (const key in obj) {
    const value = obj[key];
    const newKey = current ? `${current}.${key}` : key; // joined key with dot
    if (value && typeof value === "object") {
      if (_.isArray(value) && value[0]) {
        toDotNotation(value[0], res, `${newKey}._array`); // it's an array object, so do it again (to identify array '._array' is added)
      } else {
        toDotNotation(value, res, newKey); // it's a nested object, so do it again
      }
    } else {
      res[newKey] = value; // it's not an object, so set the property
    }
  }
  return res;
}

export function structureSettings(settingsInDotNotation) {
  // Form an appropriate structure so that it is easier to iterate over it in the template
  // Structure is as follows:
  //
  // arrayOfDefaultSettings: [
  //   {
  //     key: ansible.first.setting,
  //     defaultValue: some-values,
  //     description: 'description for setting 1',
  //     valueType: 'value-type-of-setting-1'
  //   },
  //   {
  //     key: ansible.second.setting,
  //     defaultValue: another-values,
  //     description: 'description for setting 2',
  //     valueType: 'value-type-of-setting-2'
  //   }
  //   {
  //     key: ansible.third.setting,
  //     defaultValue: [
  //       first-sub-value: {
  //       defaultValue: default-sub-value-1
  //       description: 'description for sub value 1'
  //       }
  //       second-sub-value: {
  //       defaultValue: default-sub-value-2
  //       description: 'description for sub value 2'
  //       }
  //     ],
  //     valueType: 'list'
  //   }
  // ]

  const settingsArray = [];
  const objWithArrayValues = [];
  const keysWithArrayValues = []; // keep track of keys whose elements are array
  for (const k in settingsInDotNotation) {
    const keyArray = k.split(".");
    keyArray.splice(-1, 1);
    const key = keyArray.join(".");

    // Find keys that have array elements
    const arrayElementIndex = keyArray.findIndex((e) => e === "_array");
    const arrayElement =
      arrayElementIndex >= 0 ? keyArray[arrayElementIndex - 1] : undefined;

    // if found, make a combined obj of such elements and group them later
    if (arrayElement) {
      keysWithArrayValues.push(keyArray.slice(0, arrayElementIndex).join("."));
      const arrayObj = {
        parent: keyArray.slice(0, arrayElementIndex).join("."),
        key: keyArray[arrayElementIndex + 1],
        defaultValue: settingsInDotNotation[`${key}.default`].toString() // convert to string for showing the actual value in doc
          ? settingsInDotNotation[`${key}.default`]
          : "",
        description: settingsInDotNotation[`${key}.description`],
      };

      objWithArrayValues.push(arrayObj);
      // break;
    } else {
      const obj = {
        setting: key,
        defaultValue: settingsInDotNotation[`${key}.default`].toString() // convert to string for showing the actual value in doc
          ? settingsInDotNotation[`${key}.default`]
          : "",
        description: settingsInDotNotation[`${key}.description`],
        valueType: typeof settingsInDotNotation[`${key}.default`],
      };

      settingsArray.push(obj);
    }
  }

  // group the array elements based on their parent key
  const arrayObjFinal = _.groupBy(
    makeSettingsUnique(objWithArrayValues),
    (obj) => obj.parent,
  );

  // add them back to the settingsArray with appropriate structure and value
  for (const k in arrayObjFinal) {
    const obj = {
      setting: k,
      defaultValue: arrayObjFinal[k],
      valueType: "list",
    };

    settingsArray.push(obj);
  }

  return makeSettingsUnique(settingsArray);
}

export function makeSettingsUnique(arrayObject) {
  const uniqueSettings = arrayObject.filter((value, index) => {
    const _value = JSON.stringify(value);
    return (
      index ===
      arrayObject.findIndex((obj) => {
        return JSON.stringify(obj) === _value;
      })
    );
  });

  return uniqueSettings;
}
