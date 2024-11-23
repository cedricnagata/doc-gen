const fdk = require('@fnproject/fdk');
const common = require("oci-common");
const os = require("oci-objectstorage");
const fs = require("fs");

fdk.handle(async function handler(ctx, data) {
    try {
        const payload = data._body;
        
        // Extract data from the payload
        const {
            data: sourceData,
            template: templateData,
            output: outputData
        } = payload;

        // Create a single provider instance for both calls
        const provider = await common.ResourcePrincipalAuthenticationDetailsProvider.builder();
        const client = new os.ObjectStorageClient({
            authenticationDetailsProvider: provider
        });
        
        const template = await getObject(templateData.bucketName, templateData.objectName, client);
        const jsonData = await getObject(sourceData.bucketName, sourceData.objectName, client);

        const parsedData = JSON.parse(jsonData);
        
        // Generate the document by merging template with data
        const generatedDocument = generateDocument(template, parsedData);

        await putObject(
            outputData.bucketName,
            outputData.objectName,
            generatedDocument,
            outputData.contentType,
            client
        );

        return {
            statusCode: 200,
            body: {"template": template, "json": jsonData},
            headers: {
                "Content-Type": "application/json"
            }
        };
    } catch (e) {
        console.log(Error(`Failed with error: ${e}`));
    }
});

async function getObject(bucketName, objectName, client) {
    try {    
        // Get namespace
        const request = {};
        const response = await client.getNamespace(request);
        const namespace = response.value;

        const getObjectRequest = {
            objectName: objectName,
            bucketName: bucketName,
            namespaceName: namespace
        };

        const object = await client.getObject(getObjectRequest);
        
        return object.data
    } catch (error) {
        return { content: `Failed: ${error.message}` };
    }
}

async function putObject(bucketName, objectName, content, contentType, client) {
    try {    
        // Get namespace
        const request = {};
        const response = await client.getNamespace(request);
        const namespace = response.value;

        const putObjectRequest = {
            namespaceName: namespace,
            bucketName: bucketName,
            objectName: objectName,
            putObjectBody: content,
            contentType: contentType
        };
        
        const putObjectResponse = await client.putObject(putObjectRequest);
        
        return putObjectResponse
    } catch (error) {
        return { content: `Failed: ${error.message}` };
    }
}

function generateDocument(template, data) {
    let document = template;
    
    // Replace simple placeholders
    for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'object') {
            const regex = new RegExp(`{${key}}`, 'g');
            document = document.replace(regex, value);
        }
    }
    
    // Handle nested objects and arrays
    function processNestedPath(path) {
        const parts = path.match(/\[(.*?)\]/)[1].split('.');
        let value = data;
        for (const part of parts) {
            if (!value) return '';
            value = value[part];
        }
        return value || '';
    }
    
    // Replace array/nested object placeholders
    const nestedRegex = /{([^{}]+?\[[^{}]+?\][^{}]*?)}/g;
    document = document.replace(nestedRegex, (match, path) => {
        return processNestedPath(path);
    });
    
    return document;
}
