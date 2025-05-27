const vscode = require('vscode');

function activate(context) {
  let visualizeCommand = vscode.commands.registerCommand('extension.validationRuleViewer', function () {
    vscode.window.showInformationMessage('SFVRV - Opening View of "Validation Rule".');
    openWebview(true, context);
  });

  let selectionOnlyViewerCommand = vscode.commands.registerCommand('extension.selectionOnlyViewer', function () {
    vscode.window.showInformationMessage('SFVRV - Opening View of "Selection Only".');
    openWebview(false, context);
  });

  context.subscriptions.push(visualizeCommand, selectionOnlyViewerCommand);
}

function openWebview(isValidationRule, context) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('SFVRV - No editor active. Open an XML file.');
    return;
  }

  const document = editor.document;
  const selection = editor.selection;
  var fullText;

  if (!isValidationRule) {
    if (selection.isEmpty) {
      vscode.window.showErrorMessage('SFVRV - Nothing selected.');
      return;
    }
  } else {
    fullText = document.getText();
    const hasFormulaTag = /<errorConditionFormula>([\s\S]*?)<\/errorConditionFormula>/.test(fullText);
    if (!hasFormulaTag) {
      vscode.window.showErrorMessage('SFVRV - "errorConditionFormula" Validation Rule not found.');
      return;
    }
  }
  const selectedText = editor.document.getText(selection);
  
  

  const metadata = isValidationRule
    ? extractMetadataFields(fullText)
    : selectedText;

  const panel = vscode.window.createWebviewPanel(
    'metadataPreview',
    isValidationRule ? 'SFVRV - Validation Rule' : 'SFVRV - Text Selected',
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  panel.webview.html = (isValidationRule)
    ? getWebviewContentVR(metadata)
    : getWebviewContentSelectionOnly(metadata);

  panel.webview.onDidReceiveMessage(
    async message => {
      if (message.command === 'saveFormula') {
        const newFormula = escapeHtmlToXml(message.text);

        if (!editor) {
          vscode.window.showErrorMessage('SFVRV - No active editor to save the formula.');
          return;
        }

        const document = editor.document;
        const originalText = document.getText();

        let edit = new vscode.WorkspaceEdit();

        if (isValidationRule) {
          // Substitui dentro da tag <errorConditionFormula>
          const newText = originalText.replace(
            /(<errorConditionFormula>)([\s\S]*?)(<\/errorConditionFormula>)/,
            `$1${newFormula}$3`
          );

          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(originalText.length)
          );
          edit.replace(document.uri, fullRange, newText);
        } else {
          // Substitui apenas o texto selecionado
          if (selection.isEmpty) {
            vscode.window.showErrorMessage('SFVRV - No text selected to replace.');
            return;
          }
          edit.replace(document.uri, selection, newFormula);
        }

        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
          vscode.window.showInformationMessage('SFVRV - Content updated successfully.');
          await document.save();
        } else {
          vscode.window.showErrorMessage('SFVRV - Failed to update the content.');
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

function escapeHtmlToXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;')
    .replace(/"/g, '&quot;');
}

function extractMetadataFields(xmlValidationRuleText) {
  function getValue(tag) {
    const match = xmlValidationRuleText.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    return match ? match[1].trim() : '';
  }

  return {
    fullName: getValue('fullName'),
    active: getValue('active'),
    description: getValue('description'),
    errorMessage: getValue('errorMessage'),
    errorConditionFormula: getValue('errorConditionFormula')
  };
}

function getWebviewContentVR(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: monospace;
      background-color: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }
    textarea {
      width: 100%;
      height: 300px;
      background: #252526;
      color: #d4d4d4;
      border: 1px solid #333;
      font-family: monospace;
      padding: 10px;
      white-space: pre-wrap;
    }
    button {
      margin-top: 10px;
      padding: 6px 12px;
      background-color: #007acc;
      border: none;
      color: white;
      cursor: pointer;
      font-weight: bold;
    }
    h2 {
      color: #569CD6;
    }
    .field-label {
      font-weight: bold;
      color: #9CDCFE;
    }
    .field-value {
      margin-bottom: 10px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h2>Validation Rule: ${data.fullName}</h2>

  <div><span class="field-label">Active:</span> ${data.active}</div>
  <div><span class="field-label">Description:</span> <div class="field-value">${data.description || '(empty)'}</div></div>
  <div><span class="field-label">Error Message:</span> <div class="field-value">${data.errorMessage}</div></div>

  <h3>Error Condition Formula:</h3>
  <textarea id="formulaArea">${data.errorConditionFormula}</textarea>
  <br>
  <button onclick="sendSave()">Save</button>

  <script>
    const vscode = acquireVsCodeApi();
    function sendSave() {
      const text = document.getElementById('formulaArea').value;
      vscode.postMessage({
        command: 'saveFormula',
        text: text
      });
    }
  </script>
</body>
</html>`;
}

function getWebviewContentSelectionOnly(data) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: monospace;
      background-color: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }
    textarea {
      width: 100%;
      height: 300px;
      background: #252526;
      color: #d4d4d4;
      border: 1px solid #333;
      font-family: monospace;
      padding: 10px;
      white-space: pre-wrap;
    }
    button {
      margin-top: 10px;
      padding: 6px 12px;
      background-color: #007acc;
      border: none;
      color: white;
      cursor: pointer;
      font-weight: bold;
    }
    h2 {
      color: #569CD6;
    }
    .field-label {
      font-weight: bold;
      color: #9CDCFE;
    }
    .field-value {
      margin-bottom: 10px;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h2>CONTENT SELECTED: </h2>
  <textarea id="formulaArea">${data}</textarea>
  <br>
  <button onclick="sendSave()">Save</button>

  <script>
    const vscode = acquireVsCodeApi();
    function sendSave() {
      const text = document.getElementById('formulaArea').value;
      vscode.postMessage({
        command: 'saveFormula',
        text: text
      });
    }
  </script>
</body>
</html>`;
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
