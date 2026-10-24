import { readdirSync, readFileSync } from 'node:fs';

const selectors = [...new Set(readdirSync('src', { recursive: true, encoding: 'utf8' }).filter(file => file.endsWith('.astro')).flatMap(file => [...readFileSync(`src/${file}`, 'utf8').matchAll(/(?<![\w:-])(class|id)\s*=\s*"([^"{}]*)"/g)]).flatMap(([, attribute, value]) => (value.match(/[A-Za-z_][\w-]*/g) ?? []).map(name => `${attribute === 'class' ? '.' : '#'}${name}`)))].filter(selector => !/^.[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(selector));

export default {
    extends: 'stylelint-config-standard-scss',
    rules: {
        'keyframes-name-pattern': ['^--[a-z][a-z0-9]*(-[a-z0-9]+)*$', {
            message: 'Expected keyframe name "%s" to be kebab-case and prefixed with "--" to match the rule for all user-defined things in css.'
        }],
        'layer-name-pattern': ['^--[a-z][a-z0-9]*(-[a-z0-9]+)*$', {
            message: 'Expected layer name "%s" to be kebab-case and prefixed with "--" to match the rule for all user-defined things in css.'
        }],
        'container-name-pattern': ['^--[a-z][a-z0-9]*(-[a-z0-9]+)*$', {
            message: 'Expected container name "%s" to be kebab-case and prefixed with "--" to match the rule for all user-defined things in css.'
        }],
        'declaration-property-value-allowed-list': [{
            '/^counter-(reset|increment|set)$/': ['/^(none|--[a-z][a-z0-9]*(-[a-z0-9]+)*(\\s+-?\\d+)?(\\s+--[a-z][a-z0-9]*(-[a-z0-9]+)*(\\s+-?\\d+)?)*)$/'],
            'view-transition-name': ['/^(none|root|match-element|--[a-z][a-z0-9]*(-[a-z0-9]+)*)$/']
        }, {
            message: 'Unexpected "%s: %s": counter and view transition names must be kebab-case and prefixed with "--" to match the rule for all user-defined things in css.'
        }],
        'scss/dollar-variable-pattern': ['^(-|_)?[a-z][a-z0-9]*(-[a-z0-9]+)*$', {
            message: 'Expected variable name "%s" to be kebab-case, optionally prefixed with "_".'
        }],
        'selector-class-pattern': [`^(?!(?:${selectors.filter(selector => selector.startsWith('.')).map(selector => selector.slice(1)).join('|')})$)`, {
            message: 'Expected class selector "%s" to be kebab-case.'
        }],
        'selector-id-pattern': [`^(?!(?:${selectors.filter(selector => selector.startsWith('#')).map(selector => selector.slice(1)).join('|')})$)`, {
            message: 'Expected id selector "%s" to be kebab-case.'
        }],
        'property-no-deprecated': [true, {
            ignoreProperties: ['word-wrap']
        }],
        'property-no-vendor-prefix': true
    },
    overrides: [
        {
            files: ['src/styles/variables/tokens.scss'],
            rules: {
                'scss/dollar-variable-colon-space-before': null,
                'scss/dollar-variable-colon-space-after': null
            }
        }
    ]
};
