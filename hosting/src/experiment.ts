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

    const consent = {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
    <div style="margin-left: 200px; margin-right: 200px; text-align: left;">
      <b><p style="margin-bottom: 20px;">Please consider this information carefully before deciding whether to participate in this research.</p></b>
      
      <p style="margin-bottom: 20px;">The purpose of this research is to examine which factors influence linguistic meaning. You will be asked to make judgements about the meaning of sentences in different scenarios. We are simply interested in your judgement. The study will take less than 1 hour to complete, and you will receive less than $20 on Prolific. Your compensation and time commitment are specified in the study description. There are no anticipated risks associated with participating in this study. The effects of participating should be comparable to those you would ordinarily experience from viewing a computer monitor and using a mouse or keyboard for a similar amount of time. At the end of the study, we will provide an explanation of the questions that motivate this line of research and will describe the potential implications.</p>
      
      <p style="margin-bottom: 20px;"margin-bottom: 50px;>Your participation in this study is completely voluntary and you may refuse to participate or you may choose to withdraw at any time without penalty or loss of benefits to you which are otherwise entitled. Your participation in this study will remain confidential. No personally identifiable information will be associated with your data. Also, all analyses of the data will be averaged across all the participants, so your individual responses will never be specifically analyzed.</p>
      
      <p style="margin-bottom: 20px;">If you have questions or concerns about your participation or payment, or want to request a summary of research findings, please contact Dr. Jonathan Phillips at <a href="mailto:Jonathan.S.Phillips@dartmouth.edu">Jonathan.S.Phillips@dartmouth.edu</a>.</p>
      
      <p style="margin-bottom: 20px;">Please save a copy of this form for your records.</p>
      
      <h3><b>Agreement:</b></h3>
      
      <p>The nature and purpose of this research have been sufficiently explained and I agree to participate in this study. I understand that I am free to withdraw at any time without incurring any penalty. Please consent by clicking the button below to continue. Otherwise, please exit the study at any time.</p>
    </div>
  `,
    choices: ['Submit'],
    //this specifies the way in which the data will be configured inside jspsych data variable...
    data: {
      internal_type: 'consent',
      trial_name: 'consent',
    },
  }
  timeline.push(consent)


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
    { stimulus: '<p>There are two ways to get $5 from Mr. Johnson: mowing his lawn or cleaning his gutters. However, Laura believes Mr. Johnson will only give you $5 for mowing his lawn.</p> <p>She tells you: “If you mow Mr. Johnson’s lawn, he’ll pay you $5.”</p>', prompt: 'Do you think Laura would accept the following statement: “If you don’t mow Mr. Johnson’s lawn, he won’t pay you $5.”'},
    { stimulus: '<p>There are two ways to get $5 from Mr. Johnson: mowing his lawn or cleaning his gutters. Laura knows that Mr. Johnson will give you $5 for both mowing his lawn and cleaning his gutters.</p> <p>She tells you: “If you mow Mr. Johnson’s lawn, he’ll pay you $5.”</p>', prompt: 'Do you think Laura would accept the following statement: “If you don’t mow Mr. Johnson’s lawn, he won’t pay you $5.”'},
    { stimulus: '<p>Bob has two risk factors for cardiovascular disease: he smokes and he drinks excessively. However, Dr. Smith only knows about Bob’s smoking.</p> <p>He tells you: “If Bob doesn’t quit smoking, he’ll get cardiovascular disease.”</p>',  prompt: 'Do you think Dr. Smith would accept the following statement: “If Bob quits smoking, he won’t get cardiovascular disease.”'},
    { stimulus: '<p>Bob has two risk factors for cardiovascular disease: he smokes and he drinks excessively. Dr. Smith knows about both risk factors.</p> <p>He tells you: “If Bob doesn’t quit smoking, he’ll get cardiovascular disease.”</p>',  prompt: 'Do you think Bob’s doctor would accept the following statement: “If Bob quits smoking, he won’t get cardiovascular disease.”'},
    { stimulus: '</p>There are two ways for Samantha to get to work: taking the train or taking an e-bike. However, Skipper believes that Samantha can only get to work by train.</p> <p>He tells you: “The train outage made Samantha late.”</p>', prompt: 'Do you think Skipper would accept the following statement: “If there hadn’t been a train outage, Samantha would have been on time.”'},
    { stimulus: '<p>There are two ways for Samantha to get to work: taking the train or taking an e-bike. Skipper knows that Samantha can get to work by either means.</p> <p>He tells you: “The train outage made Samantha late.”</p>', prompt: 'Do you think Skipper would accept the following statement: “If there hadn’t been a train outage, Samantha would have been on time.”'},
    { stimulus: '<p>Susie has stopped feeding her goldfish and cleaning its tank. Her father only knows that Susie has stopped cleaning the goldfish’s tank.</p><p>He tells you: “Susie not cleaning the tank killed the goldfish.”</p>', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie had cleaned the fish tank, the goldfish wouldn’t have died.”'},
    { stimulus: '<p>Susie has stopped feeding her goldfish and cleaning its tank. Her father knows that Susie hasn’t been feeding her goldfish or cleaning its tank.</p> <p>He tells you: “Susie not cleaning the tank killed the goldfish.”</p>', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie had cleaned the fish tank, the goldfish wouldn’t have died.”'},
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
