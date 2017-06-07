'use strict';

const queryBuilder = require('../lib/sql-query-builder');
const _ = require('lodash');
const expect = require('chai').expect;
const astFixture = {
    type: 'select',
    distinct: null,
    columns: [
        { expr: { type: 'column_ref', table: 't', column: 'col1' }, as: null },
        { expr: { type: 'column_ref', table: 't', column: 'col2' }, as: null },
        { expr: { type: 'column_ref', table: 't', column: 'col3' }, as: 'columnAlias' }
    ],
    from: [{ db: null, table: 't', as: null }],
    where: null,
    groupby: null,
    orderby: null,
    limit: null
};
const ImplementationError = require('flora-errors').ImplementationError;

describe('SQL query builder', () => {
    let ast;

    beforeEach(() => {
        ast = _.cloneDeep(astFixture);
    });

    afterEach(() => {
        ast = null;
    });

    describe('order', () => {
        it('should order by one attribute', () => {
            queryBuilder({
                order: [{ attribute: 'col1', direction: 'asc' }],
                queryAST: ast
            });
            expect(ast.orderby).to.eql([{
                expr: { type: 'column_ref', table: 't', column: 'col1' },
                type: 'ASC'
            }]);
        });

        it('should resolve alias to column', () => {
            queryBuilder({
                order: [{ attribute: 'columnAlias', direction: 'desc' }],
                queryAST: ast
            });
            expect(ast.orderby).to.eql([{
                expr: { type: 'column_ref', table: 't', column: 'col3' },
                type: 'DESC'
            }]);
        });

        it('should order by multiple attributes', () => {
            queryBuilder({
                order: [
                    { attribute: 'col1', direction: 'asc' },
                    { attribute: 'col2', direction: 'desc' }
                ],
                queryAST: ast
            });
            expect(ast.orderby).to.eql([
                { expr: { type: 'column_ref', table: 't', column: 'col1' }, type: 'ASC' },
                { expr: { type: 'column_ref', table: 't', column: 'col2' }, type: 'DESC' }
            ]);
        });
    });

    describe('limit', () => {
        it('should set limit', () => {
            queryBuilder({
                limit: 17,
                queryAST: ast
            });
            expect(ast.limit).to.eql([
                { type: 'number', value: 0 },
                { type: 'number', value: 17 }
            ]);
        });

        it('should set limit with offset', () => {
            queryBuilder({
                limit: 10,
                page: 3,
                queryAST: ast
            });
            expect(ast.limit).to.eql([
                { type: 'number', value: 20 },
                { type: 'number', value: 10 }
            ]);
        });
    });

    describe('filter', () => {
        it('should add single "AND" condition', () => {
            queryBuilder({
                filter: [
                    [{ attribute: 'col1', operator: 'equal', value: 0 }]
                ],
                queryAST: ast
            });
            expect(ast.where).to.be.eql({
                type: 'binary_expr',
                operator: '=',
                left: { type: 'column_ref', table: 't', column: 'col1' },
                right: { type: 'number', value: 0 }
            });
        });

        it('should add multiple "AND" conditions', () => {
            queryBuilder({
                filter: [
                    [
                        { attribute: 'col1', operator: 'greater', value: 10 },
                        { attribute: 'col1', operator: 'less', value: 20 }
                    ]
                ],
                queryAST: ast
            });
            expect(ast.where).to.be.eql({
                type: 'binary_expr',
                operator: 'AND',
                left: {
                    type: 'binary_expr',
                    operator: '>',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 10 }
                },
                right: {
                    type: 'binary_expr',
                    operator: '<',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 20 }
                }
            });
        });

        it('should add mulitple "OR" conditions', () => {
            queryBuilder({
                filter: [
                    [{ attribute: 'col1', operator: 'greater', value: 10 }],
                    [{ attribute: 'col1', operator: 'less', value: 20 }]
                ],
                queryAST: ast
            });
            expect(ast.where).to.be.eql({
                type: 'binary_expr',
                operator: 'OR',
                left: {
                    type: 'binary_expr',
                    operator: '>',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 10 }
                },
                right: {
                    type: 'binary_expr',
                    operator: '<',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 20 }
                }
            });
        });

        it('should not overwrite existing where conditions (single filter)', () => {
            ast = _.assign({}, ast, {
                where: {
                    type: 'binary_expr',
                    operator: '=',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 0 }
                }
            });

            queryBuilder({
                filter: [
                    [{ attribute: 'col2', operator: 'greater', value: 100 }]
                ],
                queryAST: ast
            });

            expect(ast.where).to.be.eql({
                type: 'binary_expr',
                operator: 'AND',
                left: {
                    type: 'binary_expr',
                    operator: '=',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 0 }
                },
                right: {
                    type: 'binary_expr',
                    operator: '>',
                    left: { type: 'column_ref', table: 't', column: 'col2' },
                    right: { type: 'number', value: 100 }
                }
            });
        });

        it('should not overwrite existing where conditions (multiple filters)', () => {
            ast = _.assign({}, astFixture, {
                where: {
                    type: 'binary_expr',
                    operator: '=',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 0 }
                }
            });

            queryBuilder({
                filter: [
                    [{ attribute: 'col2', operator: 'greater', value: 100 }],
                    [{ attribute: 'columnAlias', operator: 'lessOrEqual', value: 100 }]
                ],
                queryAST: ast
            });

            expect(ast.where).to.be.eql({
                type: 'binary_expr',
                operator: 'AND',
                left: {
                    type: 'binary_expr',
                    operator: '=',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'number', value: 0 }
                },
                right: {
                    type: 'binary_expr',
                    operator: 'OR',
                    left: {
                        type: 'binary_expr',
                        operator: '>',
                        left: { type: 'column_ref', table: 't', column: 'col2' },
                        right: { type: 'number', value: 100 }
                    },
                    right: {
                        type: 'binary_expr',
                        operator: '<=',
                        left: { type: 'column_ref', table: 't', column: 'col3' },
                        right: { type: 'number', value: 100 }
                    }
                }
            });
        });

        it('should support arrays as attribute filters', () => {
            const ast = {
                type: 'select',
                distinct: null,
                columns: [
                    { expr: { type: 'column_ref', table: 't', column: 'instrumentId' }, as: null },
                    { expr: { type: 'column_ref', table: 't', column: 'exchangeId' }, as: null }
                ],
                from: [{ db: null, table: 't', as: null }],
                where: null,
                groupby: null,
                orderby: null,
                limit: null
            };

            queryBuilder({
                filter: [
                    [{
                        attribute: ['instrumentId', 'exchangeId'],
                        operator: 'equal',
                        value: [[133962, 4], [133962, 22]]
                    }]
                ],
                queryAST: ast
            });

            expect(ast.where).to.eql({
                type: 'binary_expr',
                operator: 'OR',
                left: {
                    type: 'binary_expr',
                    operator: 'AND',
                    left: {
                        type: 'binary_expr',
                        operator: '=',
                        left: { type: 'column_ref', table: 't', column: 'instrumentId' },
                        right: { type: 'number', value: 133962 }
                    },
                    right: {
                        type: 'binary_expr',
                        operator: '=',
                        left: { type: 'column_ref', table: 't', column: 'exchangeId' },
                        right: { type: 'number', value: 4 }
                    }
                },
                right: {
                    type: 'binary_expr',
                    operator: 'AND',
                    left: {
                        type: 'binary_expr',
                        operator: '=',
                        left: { type: 'column_ref', table: 't', column: 'instrumentId' },
                        right: { type: 'number', value: 133962 }
                    },
                    right: {
                        type: 'binary_expr',
                        operator: '=',
                        left: { type: 'column_ref', table: 't', column: 'exchangeId' },
                        right: { type: 'number', value: 22 }
                    }
                },
                parentheses: true
            });
        });

        _({'equal': 'IS', 'notEqual': 'IS NOT'}).forEach((sqlOperator, filterOperator) => {
            it('should support ' + filterOperator + ' operator and null values', () => {
                const ast = _.assign({}, astFixture);

                queryBuilder({
                    filter: [
                        [{ attribute: 'col1', operator: filterOperator, value: null }]
                    ],
                    queryAST: ast
                });

                expect(ast.where).to.eql({
                    type: 'binary_expr',
                    operator: sqlOperator,
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'null', value: null }
                });
            });
        });
    });

    describe('full-text search', () => {
        it('should support single attribute', () => {
            queryBuilder({
                searchable: ['col1'],
                search: 'foobar',
                queryAST: ast
            });

            expect(ast.where).to.eql({
                type: 'binary_expr',
                operator: 'LIKE',
                left: { type: 'column_ref', table: 't', column: 'col1' },
                right: { type: 'string', value: '%foobar%' }
            });
        });

        it('should support multiple attributes', () => {
            queryBuilder({
                searchable: ['col1', 'columnAlias'],
                search: 'foobar',
                queryAST: ast
            });

            expect(ast.where).to.eql({
                type: 'binary_expr',
                operator: 'OR',
                left: {
                    type: 'binary_expr',
                    operator: 'LIKE',
                    left: { type: 'column_ref', table: 't', column: 'col1' },
                    right: { type: 'string', value: '%foobar%' }
                },
                right: {
                    type: 'binary_expr',
                    operator: 'LIKE',
                    left: { type: 'column_ref', table: 't', column: 'col3' },
                    right: { type: 'string', value: '%foobar%' }
                }
            });
        });

        it('should escape special pattern characters "%" and "_"', () => {
            queryBuilder({
                searchable: ['col1'],
                search: 'f%o_o%b_ar',
                queryAST: ast
            });

            expect(ast.where).to.eql({
                type: 'binary_expr',
                operator: 'LIKE',
                left: { type: 'column_ref', table: 't', column: 'col1' },
                right: { type: 'string', value: '%f\\%o\\_o\\%b\\_ar%' }
            });
        });

        it('should support multiple attributes and non-empty where clause', () => {
            queryBuilder({
                filter: [
                    [{ attribute: 'col2', operator: 'equal', value: 5 }]
                ],
                searchable: ['col1', 'columnAlias'],
                search: 'foobar',
                queryAST: ast
            });

            expect(ast.where).to.eql({
                type: 'binary_expr',
                operator: 'AND',
                left: {
                    type: 'binary_expr',
                    operator: '=',
                    left: { type: 'column_ref', table: 't', column: 'col2' },
                    right: { type: 'number', value: 5 }
                },
                right: {
                    type: 'binary_expr',
                    operator: 'OR',
                    left: {
                        type: 'binary_expr',
                        operator: 'LIKE',
                        left: { type: 'column_ref', table: 't', column: 'col1' },
                        right: { type: 'string', value: '%foobar%' }
                    },
                    right: {
                        type: 'binary_expr',
                        operator: 'LIKE',
                        left: { type: 'column_ref', table: 't', column: 'col3' },
                        right: { type: 'string', value: '%foobar%' }
                    },
                    paren: true
                }
            });
        });
    });

    describe('limitPer', () => {
        it('should throw error if "limitPer" key is set', () => {
            expect(() => {
                queryBuilder({
                    limitPer: 'someId',
                    queryAST: ast
                });
            }).to.throw(ImplementationError, /does not support "limitPer"/);
        });
    });
});
