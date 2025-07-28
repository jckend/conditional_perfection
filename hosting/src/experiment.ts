/* eslint-disable @typescript-eslint/naming-convention */

import externalHtml from '@jspsych/plugin-external-html'
import jsPsychHtmlButtonResponse from '@jspsych/plugin-html-button-response'
import jsPsychHtmlKeyboardResponse from '@jspsych/plugin-html-keyboard-response'
import jsPsychHtmlSliderResponse from '@jspsych/plugin-html-slider-response'
import jsPsychImageKeyboardResponse from '@jspsych/plugin-image-keyboard-response'
import jsPsychPreload from '@jspsych/plugin-preload'
import { initJsPsych } from 'jspsych'

import { debugging, getUserInfo, mockStore, prolificCC, prolificCUrl } from './globalVariables'
import { saveTrialDataComplete, saveTrialDataPartial } from './lib/databaseUtils'

import type { SaveableDataRecord } from '../types/project'
import type { DataCollection } from 'jspsych'

/* Alternatively
 * type JsPsychInstance = ReturnType<typeof initJsPsych>
 * type JsPsychGetData = JsPsychInstance['data']['get']
 * export type JsPsychDataCollection = ReturnType<JsPsychGetData>
 */

const debug = debugging()
const mock = mockStore()

type Task = 'response' | 'fixation'

interface TrialData {
  task: Task
  response: Response
  correct: boolean
  correct_response: Response
  saveIncrementally: boolean
}

const debuggingText = debug ? `<br /><br />redirect link : ${prolificCUrl}` : '<br />'
const exitMessage = `<p class="text-center align-middle">
Please wait. You will be redirected back to Prolific in a few moments.
<br /><br />
If not, please use the following completion code to ensure compensation for this study: ${prolificCC}
${debuggingText}
</p>`

const exitExperiment = (): void => {
  document.body.innerHTML = exitMessage
  setTimeout(() => {
    globalThis.location.replace(prolificCUrl)
  }, 3000)
}

const exitExperimentDebugging = (): void => {
  const contentDiv = document.querySelector('#jspsych-content')
  if (contentDiv) contentDiv.innerHTML = exitMessage
}

export async function runExperiment(updateDebugPanel: () => void): Promise<void> {
  if (debug) {
    console.log('--runExperiment--')
    console.log('UserInfo ::', getUserInfo())
  }

  /* initialize jsPsych */
  const jsPsych = initJsPsych({
    on_data_update: function (trialData: TrialData) {
      if (debug) {
        console.log('jsPsych-update :: trialData ::', trialData)
      }
      // if trialData contains a saveIncrementally property, and the property is true, then save the trialData to Firestore immediately (otherwise the data will be saved at the end of the experiment)
      if (trialData.saveIncrementally) {
        saveTrialDataPartial(trialData as unknown as SaveableDataRecord).then(
          () => {
            if (debug) {
              console.log('saveTrialDataPartial: Success') // Success!
              if (mock) {
                updateDebugPanel()
              }
            }
          },
          (error: unknown) => {
            console.error(error) // Error!
          },
        )
      }
    },
    on_finish: (data: DataCollection) => {
      const contentDiv = document.querySelector('#jspsych-content')
      if (contentDiv) contentDiv.innerHTML = '<p> Please wait, your data are being saved.</p>'
      saveTrialDataComplete(data.values()).then(
        () => {
          if (debug) {
            exitExperimentDebugging()
            console.log('saveTrialDataComplete: Success') // Success!
            console.log('jsPsych-finish :: data ::')
            console.log(data)
            setTimeout(() => {
              jsPsych.data.displayData()
            }, 3000)
          } else {
            exitExperiment()
          }
        },
        (error: unknown) => {
          console.error(error) // Error!
          exitExperiment()
        },
      )
    },
  })

  /* create timeline */
  const timeline: Record<string, unknown>[] = []
  
  /* define welcome message trial */
  const welcome = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<span class="text-xl">Welcome to the experiment. Press any key to begin.</span>',
  }
  timeline.push(welcome)

  /* define instructions trial */
  const instructions = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <p>In this experiment, you will be presented with an image and asked to evaluate the truth of a sentence based on the scene.</p>
      <p>Press any key to begin.</p>
    `,
    post_trial_gap: 2000,
  }
  timeline.push(instructions)

  /* define trial stimuli array for timeline variables */
  const test_stimuli: Record<string>[] = [
    { stimulus: 'There are two ways to get $5 from Mr. Johnson: mowing his lawn or cleaning his gutters. However, Laura believes that mowing Mr. Johnson’s lawn is the only way to obtain $5 from him. She tells you: “If you mow Mr. Johnson’s lawn, he’ll pay you $5.”', prompt: 'Do you think Laura would accept the following statement: “If you don’t mow Mr. Johnson’s lawn, he won’t pay you $5.”'},
    { stimulus: 'There are two ways to get $5 from Mr. Johnson: mowing his lawn or cleaning his gutters. However, Laura knows that she can obtain $5 by either mowing Mr. Johnson’s lawn or cleaning his gutters. She tells you: “If you mow Mr. Johnson’s lawn, he’ll pay you $5.”', prompt: 'Do you think Laura would accept the following statement: “If you don’t mow Mr. Johnson’s lawn, he won’t pay you $5.”'},
    { stimulus: 'Bob has two risk factors for cardiovascular disease: he smokes and he drinks excessively. However, Bob’s doctor only knows about Bob’s drinking. He tells you: “If Bob doesn’t quit smoking, he’ll get cardiovascular disease.”',  prompt: 'Do you think Bob’s doctor would accept the following statement: “If Bob quits smoking, he won’t get cardiovascular disease.”'},
    { stimulus: 'Bob has two risk factors for cardiovascular disease: he smokes and he drinks excessively. Bob’s doctor knows about both risk factors. He tells you: “If Bob doesn’t quit smoking, he’ll get cardiovascular disease.”',  prompt: 'Do you think Bob’s doctor would accept the following statement: “If Bob quits smoking, he won’t get cardiovascular disease.”'},
    { stimulus: 'There are two ways for Samantha to get to work: taking the train or taking an e-bike. However, Skipper believes that Samantha can only get to work by train. He tells you: “The train outage made Samantha late.”', prompt: 'Do you think Skipper would accept the following statement: “If there hadn’t been a train outage, Samantha would have been on time.”'},
    { stimulus: 'There are two ways for Samantha to get to work: taking the train or taking an e-bike. Skipper knows that Samantha can get to work by either means. He tells you: “The train outage made Samantha late.”', prompt: 'Do you think Skipper would accept the following statement: “If there hadn’t been a train outage, Samantha would have been on time.”'},
    { stimulus: 'There are two ways Susie could kill her goldfish: by not feeding it and by not cleaning its tank. Her father knows that Susie has not cleaned the goldfish’s tank, but he doesn’t know that she stopped feeding it. He tells you: “Susie not cleaning the tank killed the goldfish.”', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie had cleaned the fish tank, the goldfish wouldn’t have died.”'},
    { stimulus: 'There are two ways Susie could kill her goldfish: by not feeding it and by not cleaning its tank. Her father knows that Susie has both stopped feeding the goldfish and stopped cleaning its cage. He tells you: “Susie not cleaning the tank killed the goldfish.”', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie had cleaned the fish tank, the goldfish wouldn’t have died.”'},
  ]

  /* define test trials */
  const test = {
    type: jsPsychHtmlSliderResponse,
    stimulus: () => {
    return jsPsych.evaluateTimelineVariable('stimulus') +  " " + jsPsych.evaluateTimelineVariable('prompt') ;
    },          
    labels: ["no", "unsure", "yes"],
    slider_width: 500,
    require_movement: true, 
    on_finish: function (data: TrialData) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, unicorn/no-null
      data.saveIncrementally = true
    },
  }


  /* define test procedure */
  const test_procedure = {
    timeline: [test],
    timeline_variables: test_stimuli,
    repetitions: 1,
    randomize_order: true,
  }
  timeline.push(test_procedure)


   /* define debrief */
  const debrief_block = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
      return `
          <p>Press any key to complete the experiment. Thank you!</p>`
    },
  }
  timeline.push(debrief_block)

  /* start the experiment */
  // @ts-expect-error allow timeline to be type jsPsych TimelineArray
  await jsPsych.run(timeline)
}
