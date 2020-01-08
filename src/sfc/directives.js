const t = require('babel-types');

const { getNextJSXElment } = require('./sfc-ast-helpers');
const { log, getIdentifier } = require('../utils');
const eventMap = require('./event-map');

// 如果 v-if v-else-if v-else 并列执行。而不是v-if里面立即执行v-if里面的v-if
// 
const tempConditionMap = new Map();
exports.handleIfDirective = function handleIfDirective (path, value, state) {
    // 清空它
    const parentPath = path.parentPath.parentPath;
    // console.log(parentPath);
    tempConditionMap.set(JSON.stringify(parentPath.parentPath.node.loc), []);
    const test = state.computeds[value] ? t.identifier(value) : t.memberExpression(
        t.memberExpression(t.thisExpression(), getIdentifier(state, value)),
        t.identifier(value)
    );
    tempConditionMap.get(JSON.stringify(parentPath.parentPath.node.loc)).push(test);
    parentPath.replaceWith(
        t.jSXExpressionContainer(
            t.conditionalExpression(
                test,
                parentPath.node,
                t.nullLiteral()
            )
        )
    );
    path.remove();
};
exports.handleElseIfDirective = function handleIfDirective (path, value, state) {
    const parentPath = path.parentPath.parentPath;
    const childs = parentPath.node.children;

    // Get JSXElment of v-else
    // const nextElement = getNextJSXElment(parentPath);

    // 真正的test 应该是 tempConditionMap.get(parentPath) 里面的所有条件取非
    // 并且这个地方的test 取正
    const test = state.computeds[value] ? t.identifier(value) : t.memberExpression(
        t.memberExpression(t.thisExpression(), getIdentifier(state, value)),
        t.identifier(value)
    );
    console.log('handleElseIfDirective', test);
    parentPath.replaceWith(
        t.jSXExpressionContainer(
            t.conditionalExpression(
                !test,
                parentPath.node,
                t.nullLiteral()
            )
        )
    );
    tempConditionMap.get(JSON.stringify(parentPath.node.loc)).push(test);
    path.remove();
};
exports.handleElseDirective = function handleIfDirective (path, value, state) {
    const parentPath = path.parentPath.parentPath;
    parentPath.replaceWith(
        t.jSXExpressionContainer(
            t.conditionalExpression(
                tempConditionMap.get(JSON.stringify(parentPath.parentPath.node.loc))[0],
                // test,
                t.nullLiteral(),
                parentPath.node
            )
        )
    );
    path.remove();
};

exports.handleShowDirective = function handleShowDirective (path, value, state) {
    const test = state.computeds[value] ? t.identifier(value) : t.memberExpression(
        t.memberExpression(t.thisExpression(), getIdentifier(state, value)),
        t.identifier(value)
    );

    path.replaceWith(
        t.jSXAttribute(
            t.jSXIdentifier('style'),
            t.jSXExpressionContainer(
                t.objectExpression([
                    t.objectProperty(
                        t.identifier('display'),
                        t.conditionalExpression(
                            test,
                            t.stringLiteral('block'),
                            t.stringLiteral('none')
                        )
                    )
                ])
            )
        )
    );
};

exports.handleOnDirective = function handleOnDirective (path, name, value) {
    const eventName = eventMap[name];
    if (!eventName) {
        log(`Not support event name`);
        return;   
    }
    path.replaceWith(
        t.jSXAttribute(
            t.jSXIdentifier(eventName),
            t.jSXExpressionContainer(
                t.memberExpression(
                    t.thisExpression(),
                    t.identifier(value)
                )
            )
        )
    );
};

exports.handleBindDirective = function handleBindDirective (path, name, value, state) {
    if (state.computeds[value]) {
        path.replaceWith(
            t.jSXAttribute(
                t.jSXIdentifier(name),
                t.jSXExpressionContainer(t.identifier(value))
            )
        );
        return;
    }
    path.replaceWith(
        t.jSXAttribute(
            t.jSXIdentifier(name),
            t.jSXExpressionContainer(
                t.memberExpression(
                    t.memberExpression(t.thisExpression(), getIdentifier(state, value)),
                    t.identifier(value)
                )
            )
        )
    );
};

exports.handleForDirective = function handleForDirective (path, value, definedInFor, state) {
    const parentPath = path.parentPath.parentPath;
    const childs = parentPath.node.children;
    const element = parentPath.node.openingElement.name.name;

    const a = value.split(/\s+?in\s+?/);
    const prop = a[1].trim();

    const params = a[0].replace('(', '').replace(')', '').split(',');
    const newParams = [];
    params.forEach(item => {
        definedInFor.push(item.trim());
        newParams.push(t.identifier(item.trim()));
    });

    const member = state.computeds[prop] ? t.identifier(prop) : t.memberExpression(
        t.memberExpression(t.thisExpression(), getIdentifier(state, value)),
        t.identifier(prop)
    );

    parentPath.replaceWith(
        t.jSXExpressionContainer(
            t.callExpression(
                t.memberExpression(
                    member,
                    t.identifier('map')
                ),
                [
                    t.arrowFunctionExpression(
                        newParams,
                        t.blockStatement([
                            t.returnStatement(
                                t.jSXElement(
                                    t.jSXOpeningElement(t.jSXIdentifier(element), [
                                        t.jSXAttribute(
                                            t.jSXIdentifier('key'),
                                            t.jSXExpressionContainer(
                                                t.identifier('index')
                                            )
                                        )
                                    ]),
                                    t.jSXClosingElement(t.jSXIdentifier(element)),
                                    childs
                                )
                            )
                        ])
                    )
                ]
            )
        )
    );
};

exports.handleTextDirective = function handleTextDirective (path, value, state) {
    const parentPath = path.parentPath.parentPath;

    if (state.computeds[value]) {
        parentPath.node.children.push(
            t.jSXExpressionContainer(
                t.callExpression(
                    t.memberExpression(
                        t.identifier(value),
                        t.identifier('replace')
                    ),
                    [
                        t.regExpLiteral('<[^>]+>', 'g'),
                        t.stringLiteral('')
                    ]
                )
            )
        );
        return;
    }

    parentPath.node.children.push(
        t.jSXExpressionContainer(
            t.callExpression(
                t.memberExpression(
                    t.memberExpression(
                        t.memberExpression(t.thisExpression(), getIdentifier(state, value)),
                        t.identifier(value)
                    ),
                    t.identifier('replace')
                ),
                [
                    t.regExpLiteral('<[^>]+>', 'g'),
                    t.stringLiteral('')
                ]
            )
        )
    );
};

exports.handleHTMLDirective = function handleHTMLDirective (path, value, state) {
    const val = state.computeds[value] ? t.identifier(value) : t.memberExpression(
        t.memberExpression(t.thisExpression(), getIdentifier(state, value)),
        t.identifier(value)
    );

    path.replaceWith(
        t.jSXAttribute(
            t.jSXIdentifier('dangerouslySetInnerHTML'),
            t.jSXExpressionContainer(
                t.objectExpression(
                    [
                        t.objectProperty(t.identifier('__html'), val)
                    ]
                )
            )
        )
    );
};
