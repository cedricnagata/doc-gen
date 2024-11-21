const fdk = require('@fnproject/fdk');
const createReport = require('docx-templates').default;
const fs = require('fs').promises;

async function processTemplate(templateBuffer, data) {
  try {
    const buffer = await createReport({
      template: templateBuffer,
      data: data,
      cmdDelimiter: ['{', '}'],  // Match your existing delimiter style
    });
    return buffer;
  } catch (error) {
    console.error('Error processing template:', error);
    throw error;
  }
}

async function handleRequest(context, input) {
  try {
    // Input should contain base64 encoded template and JSON data
    const { template, data } = input;
    
    if (!template || !data) {
      throw new Error('Missing required parameters: template and data');
    }

    // Decode base64 template
    const templateBuffer = Buffer.from(template, 'base64');
    
    // Parse JSON data if it's a string
    const jsonData = typeof data === 'string' ? JSON.parse(data) : data;

    // Process the template with nested JSON support
    const resultBuffer = await processTemplate(templateBuffer, jsonData);

    // Return base64 encoded result
    return {
      template_result: resultBuffer.toString('base64'),
      content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };

  } catch (error) {
    console.error('Error in handleRequest:', error);
    return {
      error: error.message,
      status: 400
    };
  }
}

fdk.handle(handleRequest);