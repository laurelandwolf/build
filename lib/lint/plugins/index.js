module.exports = {
  rules: {
    'lw-function-padding': function (context) {

      function functionPadding (node) {

        var blockStart = node.loc.start.line;
        var first = node.body.body[0];

        // Empty block
        if (!first) {
          return;
        }

        var firstLine = first.loc.start.line;
        var expectedFirstLine = blockStart + 2;
        var leadingComments = context.getComments(first).leading;

        if (leadingComments.length > 0) {
          firstLine = leadingComments[0].loc.start.line;
        }

        if (expectedFirstLine > firstLine) {
          context.report(node, 'function or method signature must be followed by a new line');
        }
      }

      return {
        FunctionExpression: functionPadding,
        FunctionDeclaration: functionPadding
      };
    }
  },
  rulesConfig: {
    'lw-function-padding': 2
  }
};
