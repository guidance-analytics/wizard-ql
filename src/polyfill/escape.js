const noEscape = typeof RegExp.escape === 'undefined'
if (noEscape) {
  // Whitespaces from ES spec
const WHITESPACES = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF';

const FIRST_DIGIT_OR_ASCII = /^[0-9a-z]/i;
const SYNTAX_SOLIDUS = /^[$()*+./?[\\\]^{|}]/;
const OTHER_PUNCTUATORS_AND_WHITESPACES = new RegExp(`^[!"#%&',\\-:;<=>@\`~${WHITESPACES}]`);

const ControlEscape = {
  '\u0009': 't',
  '\u000A': 'n',
  '\u000B': 'v',
  '\u000C': 'f',
  '\u000D': 'r'
};

// Using modern method to check if ControlEscape has the property
const hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);

const escapeChar = (chr) => {
  const hex = chr.charCodeAt(0).toString(16);
  return hex.length < 3 ? `\\x${hex.padStart(2, '0')}` : `\\u${hex.padStart(4, '0')}`;
};

// Check if the native implementation exists and behaves correctly
const FORCED = !RegExp.escape || RegExp.escape('ab') !== '\\x61b';

// If needed, add the polyfill
if (FORCED) {
  RegExp.escape = function escape(S) {
    // Ensure S is a string
    S = String(S);
    const length = S.length;
    const result = new Array(length);

    for (let i = 0; i < length; i++) {
      const chr = S.charAt(i);
      if (i === 0 && FIRST_DIGIT_OR_ASCII.test(chr)) {
        result[i] = escapeChar(chr);
      } else if (hasOwn(ControlEscape, chr)) {
        result[i] = '\\' + ControlEscape[chr];
      } else if (SYNTAX_SOLIDUS.test(chr)) {
        result[i] = '\\' + chr;
      } else if (OTHER_PUNCTUATORS_AND_WHITESPACES.test(chr)) {
        result[i] = escapeChar(chr);
      } else {
        const charCode = chr.charCodeAt(0);
        // single UTF-16 code unit
        if ((charCode & 0xF800) !== 0xD800) result[i] = chr;
        // unpaired surrogate
        else if (charCode >= 0xDC00 || i + 1 >= length || (S.charCodeAt(i + 1) & 0xFC00) !== 0xDC00) result[i] = escapeChar(chr);
        // surrogate pair
        else {
          result[i] = chr;
          result[++i] = S.charAt(i);
        }
      }
    }

    return result.join('');
  };
}

  RegExp.escape = escape
}