import neostandard from 'neostandard'
import jsdoc from 'eslint-plugin-jsdoc'
const tseslint = neostandard.plugins['typescript-eslint']

/** @type {import('eslint').Linter.Config[]} */
// @ts-expect-error -- typescript-eslint has a goofy return type
export default [
  ...neostandard({
    ignores: ['**/*.js', 'src/graphql/'],
    ts: true,
    env: ['node', 'es2025']
  }),
  ...tseslint.config(
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      ignores: ['**/*.js', 'src/graphql/'],
      languageOptions: {
        parser: tseslint.parser,
        parserOptions: {
          projectService: true,
          project: './tsconfig.json'
        }
      },
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-redeclare': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/explicit-function-return-type': ['error', {
          allowExpressions: true
        }],
        '@typescript-eslint/no-unused-vars': ['error', {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }],
        '@typescript-eslint/no-shadow': 'warn',
        '@typescript-eslint/consistent-type-assertions': [
          'error',
          {
            assertionStyle: 'as',
            objectLiteralTypeAssertions: 'allow'
          }
        ],
        '@typescript-eslint/no-misused-promises': [
          'error',
          {
            checksVoidReturn: {
              attributes: false
            }
          }
        ],
        '@typescript-eslint/no-invalid-void-type': 'off',
        '@typescript-eslint/consistent-type-imports': ['error', {
          prefer: 'type-imports',
          disallowTypeAnnotations: true,
          fixStyle: 'inline-type-imports'
        }],
        '@typescript-eslint/no-import-type-side-effects': 'error',
        '@typescript-eslint/no-dynamic-delete': 'warn',
        '@typescript-eslint/unbound-method': ['error', {
          ignoreStatic: true
        }],
        '@typescript-eslint/no-unnecessary-condition': 'error',
        '@typescript-eslint/prefer-optional-chain': 'error',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
        '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
        '@typescript-eslint/no-confusing-void-expression': 'off',
        '@typescript-eslint/restrict-template-expressions': ['error', {
          allowAny: true,
          allowBoolean: false,
          allowNever: false,
          allowNullish: true,
          allowNumber: true,
          allowRegExp: false
        }],
        '@typescript-eslint/restrict-plus-operands': ['error', {
          allowAny: true,
          allowBoolean: false,
          allowNullish: false,
          allowNumberAndString: true,
          allowRegExp: false
        }],
        '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/prefer-promise-reject-errors': ['error', {
          allowThrowingAny: true,
          allowThrowingUnknown: true
        }],
        '@typescript-eslint/no-unnecessary-type-parameters': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/prefer-regexp-exec': 'off',
        '@typescript-eslint/return-await': 'error',
        '@typescript-eslint/no-base-to-string': 'error',
        '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-for-in-array': 'error',
        '@typescript-eslint/require-array-sort-compare': ['error', { ignoreStringArrays: true }],
        '@typescript-eslint/prefer-readonly': 'error',
        '@typescript-eslint/method-signature-style': 'error',
        '@typescript-eslint/naming-convention': ['error', {
          selector: 'variableLike',
          leadingUnderscore: 'allow',
          trailingUnderscore: 'allow',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE']
        }],
        '@typescript-eslint/adjacent-overload-signatures': 'error',
        '@typescript-eslint/ban-tslint-comment': 'error',
        '@typescript-eslint/prefer-reduce-type-parameter': 'error',
        '@typescript-eslint/prefer-return-this-type': 'error',
        '@typescript-eslint/prefer-ts-expect-error': 'error',
        '@typescript-eslint/non-nullable-type-assertion-style': 'error',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/prefer-includes': 'error'
      }
    }
  ),
  {
    ...jsdoc.configs['flat/recommended-typescript-error'],
    name: 'jsdoc',
    files: ['**/*.ts*', '**/*.*js'],
    ignores: ['migrations/**/*', 'src/components/ui/**/*', 'src/graphql/'],
    plugins: {
      jsdoc
    },
    rules: {
      ...jsdoc.configs['flat/recommended-typescript-error'].rules,
      'jsdoc/require-jsdoc': ['error', {
        require: {
          ArrowFunctionExpression: false,
          ClassDeclaration: true,
          ClassExpression: true,
          FunctionDeclaration: false,
          FunctionExpression: false,
          MethodDefinition: true
        },
        contexts: ['ClassProperty', 'FunctionDeclaration:not(:matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression) FunctionDeclaration)'],
        checkGetters: false,
        checkSetters: false
      }],
      'jsdoc/check-line-alignment': ['error', 'always', {
        tags: ['param', 'arg', 'argument', 'property', 'prop', 'returns', 'return', 'throws']
      }],
      'jsdoc/require-returns': ['error', {
        checkGetters: false,
        contexts: [
          'FunctionDeclaration[returnType.typeAnnotation.typeName.name!=ReactNode][returnType.typeAnnotation.typeName.right.name!=ReactNode][returnType.typeAnnotation.type!=TSVoidKeyword]:not([returnType.typeAnnotation.typeArguments.parent.typeName.name=Promise][returnType.typeAnnotation.typeArguments.params.0.type=TSVoidKeyword])',
          'FunctionExpression[returnType.typeAnnotation.typeName.name!=ReactNode][returnType.typeAnnotation.typeName.right.name!=ReactNode][returnType.typeAnnotation.type!=TSVoidKeyword]:not([returnType.typeAnnotation.typeArguments.parent.typeName.name=Promise][returnType.typeAnnotation.typeArguments.params.0.type=TSVoidKeyword])'
        ]
      }],
      'jsdoc/require-throws': 'error',
      'jsdoc/require-description': 'error',
      'jsdoc/require-asterisk-prefix': 'error',
      'jsdoc/require-param': ['error', {
        contexts: [
          'FunctionDeclaration:matches([params.1], :not([params.0.typeAnnotation.typeAnnotation.type=TSTypeReference]))',
          'FunctionExpression:matches([params.1], :not([params.0.typeAnnotation.typeAnnotation.type=TSTypeReference]))'
        ]
      }],
      'jsdoc/require-param-description': ['error', {
        contexts: [
          'FunctionDeclaration[returnType.typeAnnotation.typeName.name!=ReactNode][returnType.typeAnnotation.typeName.right.name!=ReactNode]:matches([params.1], :not([params.0.typeAnnotation.typeAnnotation.type=TSTypeReference]))',
          'FunctionExpression[returnType.typeAnnotation.typeName.name!=ReactNode][returnType.typeAnnotation.typeName.right.name!=ReactNode]:matches([params.1], :not([params.0.typeAnnotation.typeAnnotation.type=TSTypeReference]))',
          'ArrowFunctionExpression[returnType.typeAnnotation.typeName.name!=ReactNode][returnType.typeAnnotation.typeName.right.name!=ReactNode]:matches([params.1], :not([params.0.typeAnnotation.typeAnnotation.type=TSTypeReference]))'
        ]
      }],
      'jsdoc/check-tag-names': ['error', {
        definedTags: ['note', 'warn', 'todo', 'experimental']
      }]
    },
    settings: {
      ...jsdoc.configs['flat/recommended-typescript-error'].settings,
      exemptDestructuredRootsFromChecks: true
    }
  },
  {
    name: 'overrides',
    files: ['**/*.ts*', '**/*.*js', 'src/graphql/'],
    rules: {
      'no-debugger': 'error',
      'no-console': ['error', {
        allow: ['info', 'log', 'warn', 'error'] // Not `debug`
      }],
      'no-void': 'off',
      'import/no-anonymous-default-export': 'off',

      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/member-delimiter-style': ['error', {
        multiline: {
          delimiter: 'none'
        },
        singleline: {
          delimiter: 'comma',
          requireLast: false
        }
      }],
      'react/jsx-handler-names': 'off',
      '@stylistic/indent': ['error', 2, {
        SwitchCase: 1,
        VariableDeclarator: 1,
        outerIIFEBody: 1,
        MemberExpression: 1,
        FunctionDeclaration: { parameters: 1, body: 1 },
        FunctionExpression: { parameters: 1, body: 1 },
        CallExpression: { arguments: 1 },
        ArrayExpression: 1,
        ObjectExpression: 1,
        ImportDeclaration: 1,
        flatTernaryExpressions: false,
        ignoreComments: false,
        ignoredNodes: ['TemplateLiteral *', 'JSXElement', 'JSXElement > *', 'JSXAttribute', 'JSXIdentifier', 'JSXNamespacedName', 'JSXMemberExpression', 'JSXSpreadAttribute', 'JSXExpressionContainer', 'JSXOpeningElement', 'JSXClosingElement', 'JSXFragment', 'JSXOpeningFragment', 'JSXClosingFragment', 'JSXText', 'JSXEmptyExpression', 'JSXSpreadChild'],
        offsetTernaryExpressions: false
      }],
      '@stylistic/array-bracket-newline': ['error', 'consistent'],
      '@stylistic/array-element-newline': ['error', 'consistent'],
      '@stylistic/jsx-max-props-per-line': ['error', {
        maximum: 1,
        when: 'multiline'
      }]
    }
  },
  {
    name: 'vanilla overrides',
    files: ['**/*.*js', 'src/graphql/'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'jsdoc/check-tag-names': 'off',
      'jsdoc/no-types': 'off'
    }
  }
]
