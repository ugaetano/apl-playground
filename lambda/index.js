const Alexa = require('ask-sdk-core');
let layoutsList = [];
let globalDatasources

// Checks for generic interface availability on calling device
function supportsInterface(handlerInput, interfaceName){
    const interfaces = ((((
        handlerInput.requestEnvelope.context || {})
        .System || {})
        .device || {})
        .supportedInterfaces || {});
    return interfaces[interfaceName] !== null && interfaces[interfaceName] !== undefined;
}

// Checks for APL Interface availability on calling device
function supportsAPL(handlerInput) {
    return supportsInterface(handlerInput, 'Alexa.Presentation.APL')
}

// Checks for APL-T Interface availability on calling device
function supportsAPLT(handlerInput) {
    return supportsInterface(handlerInput, 'Alexa.Presentation.APLT')
}

// Gets an array with the filename(s) from the ./layouts lambda folder
function retrieveFilesFromLambda() {
    const testFolder = './layouts/';
    const fs = require('fs');

    try 
    {
    fs.readdirSync(testFolder).forEach(file => {
        if (file.endsWith("_datasources.json")) 
        {
            console.log("skipping " + file + " since datasources")
        }
        else 
        {
            if (file.endsWith(".json"))
            {
                layoutsList.push(file)
            }
        }
                                                })
        }
        catch (error) {
        console.log("error: ", error)
        }
}

// Checks if the file is exported from the authoring tool (contains both "document" and "datasources" key)
function isExported (fileName)
{
    let fs = require('fs');
    let documentObject = JSON.parse(fs.readFileSync('./layouts/'+ fileName, 'utf8'));
    return (documentObject.hasOwnProperty("document") && documentObject.hasOwnProperty("datasources"))
}

// Builds the datasources object that will eventually populate the Sequence with filename(s).
function buildDataSources()
{
    let fs = require('fs');
    let dataSourcesObject = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
    dataSourcesObject.data.values = layoutsList;
    console.log("dataSourcesObject = " + JSON.stringify(dataSourcesObject));
    return dataSourcesObject;
}

// Lets you render the document regardless of how it's made. doesn't matter if exported from the outhoring tool or copy-pasted in separate files.
function inflateDocument(handlerInput, layoutToInflate)
{
    let speakOutput,doc,data
    let fs = require('fs')
    let documentObject = JSON.parse(fs.readFileSync('./layouts/'+ layoutToInflate, 'utf8'));
    
    // If both "document" and "datasources" key are present in the same file, use the "datasources" of the file itself
    if (isExported(layoutToInflate))
    {
        doc = documentObject.document
        data = documentObject.datasources
        speakOutput = "Rendering " + layoutToInflate
    }
    
    // If a file ending in _datasources.json is present, use it as "datasources" of the chosen layout to render
    else
    {
        doc = documentObject
        let path = './layouts/'+ layoutToInflate
        console.log ("PATH NEW: " + path)
        path = path.replace('.json','_datasources.json')
        try {
            
        if (fs.existsSync(path)) 
        {
            data = JSON.parse(fs.readFileSync(path, 'utf8'));
        }
        
         else
        {
            data = null
        }
        
        } catch(err) {
        console.error(err)
        }
        speakOutput = "Rendering " + layoutToInflate

    }
         
         return handlerInput.responseBuilder
        .speak(speakOutput)
         .addDirective({
          type:'Alexa.Presentation.APL.RenderDocument',
          token :'documentToken',
          document: doc,
          datasources: data,
        })
        .getResponse();

}

// APL UserEvent handler (TouchWrapper)
const sendEventHandler = {
  canHandle(handlerInput) { 
    const request = handlerInput.requestEnvelope.request;

    // Catches the APL.UserEvent
    return request.type === 'Alexa.Presentation.APL.UserEvent' && request.arguments.length > 0;
  },
  handle(handlerInput) {

    // Logs the incoming UserEvent
    console.log("APL UserEvent to the skill: " + JSON.stringify(handlerInput.requestEnvelope.request))
    
    // Checks if the request comes from the load button and retrieves the layout to inflate
    let loadButtonPressed = (handlerInput.requestEnvelope.request.arguments[0] === "render")
    if (loadButtonPressed) 
    {
        // Gets the file name of the layout to render. (components[] array of the APL.UserEvent)
        let layoutToInflate = (handlerInput.requestEnvelope.request.components.fileNameToLoad);
    
        // Calls the inflateDocument function that has all the logic
        if (layoutToInflate == "dummy")
        {
            return handlerInput.responseBuilder
            .speak("No document selected")
            .getResponse();
        }
        return inflateDocument(handlerInput, layoutToInflate)
    }
      

  }
    
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        layoutsList = [];
        globalDatasources = buildDataSources()
        retrieveFilesFromLambda()
        
        //Logs the request
        console.log("LaunchRequest request: " + JSON.stringify(handlerInput.requestEnvelope))

        // Checks if APL is supported:
        if (supportsAPL(handlerInput))
        {
        const speakOutput = 'Welcome to APL Playground. Please select a document to render.';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .addDirective({
          type:'Alexa.Presentation.APL.RenderDocument',
          token :'documentToken',
          document: require('./launchRequest.json'),
          datasources: globalDatasources,
        })
            .getResponse();
    }

    else
    {
        const speakOutput = 'Welcome to APL Playground. You need a screen-enabled device to use the skill.';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        
    }
        
      
    }
};

const backToSelectionIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'backToSelectionIntent';
    },
    handle(handlerInput) {
        globalDatasources = buildDataSources()
        const speakOutput = 'Back to Selection';
        return handlerInput.responseBuilder
            .addDirective({
          type:'Alexa.Presentation.APL.RenderDocument',
          token :'documentToken',
          document: require('./launchRequest.json'),
          datasources: globalDatasources,
        })
            .getResponse();

    }
};

// You can use this handler to send a custom command after the document has been rendered
const executeCommandIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'executeCommandIntent';
    },
    handle(handlerInput) {
      const speakOutput = "OK, executing your command.";
      console.log("FULL JSON REQUEST FROM executeCommandIntentHandler" + JSON.stringify(handlerInput.requestEnvelope))
      
      // Add your JSON commands here
      let customCommandToSend = {
        "type": "ControlMedia",
        "componentId": "VideoPlayer",
        "command": "next"
    }
       
       return handlerInput.responseBuilder
       .speak(speakOutput)
       .addDirective({
           type: 'Alexa.Presentation.APL.ExecuteCommands',
           token: "documentToken",
           commands: [customCommandToSend]
       })
       .getResponse();

                  
   }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {

        const speakOutput = 'Hello, this skill will let you render APL layouts';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.stack}`);
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again.`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        backToSelectionIntentHandler,
        executeCommandIntentHandler,
        sendEventHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler,
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .lambda();