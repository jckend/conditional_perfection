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
    { stimulus: '<p>There are two ways to get $5 from Mr. Johnson: mowing his lawn or cleaning his gutters. However, Laura believes Mr. Johnson will only give you $5 for mowing his lawn.</p> <p>She tells you: “Mr. John will pay you $5 for mowing his lawn.”</p>', prompt: 'Do you think Laura would accept the following statement: “If you don’t mow Mr. Johnson’s lawn, he won’t pay you $5.”'},
    { stimulus: '<p>There are two ways to get $5 from Mr. Johnson: mowing his lawn or cleaning his gutters. Laura knows that Mr. Johnson will give you $5 for both mowing his lawn and cleaning his gutters.</p> <p>She tells you: “Mr. John will pay you $5 for mowing his lawn.”', prompt: 'Do you think Laura would accept the following statement: “If you don’t mow Mr. Johnson’s lawn, he won’t pay you $5.”'},
    { stimulus: '<p>There are two ways Susie’s goldfish can get sick: if she stops feeding it or cleaning its tank. Susie has stopped doing either, but her father only knows that she’s stopped cleaning the goldfish’s tank.</p><p>He tells you: “If Susie doesn’t start cleaning the fish tank, she’ll make her goldfish sick.”</p>', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie starts cleaning the fish tank, she won’t make her goldfish sick.”'},
    { stimulus: '<p>There are two ways Susie’s goldfish can get sick: if she stops feeding it or cleaning its tank. Susie’s father knows that she hasn’t been doing either.</p><p>He tells you: “If Susie doesn’t start cleaning the fish tank, she’ll make her goldfish sick.”</p>', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie starts cleaning the fish tank, she won’t make her goldfish sick.”'},
    { stimulus: '<p>There are two ways Susie’s goldfish can get sick: if she stops feeding it or cleaning its tank. Susie has stopped doing either, but her father only knows that she’s stopped cleaning the goldfish’s tank.</p><p>He tells you: “Susie will make her goldfish sick by not cleaning its tank.”</p>', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie starts cleaning the fish tank, she won’t make her goldfish sick.”'},
    { stimulus: '<p>There are two ways Susie’s goldfish can get sick: if she stops feeding it or cleaning its tank. Susie has stopped doing either, but her father only knows that she’s stopped cleaning the goldfish’s tank.</p><p>He tells you: “Susie will make her goldfish sick by not cleaning its tank.”</p>', prompt: 'Do you think Susie’s father would accept the following statement: “If Susie starts cleaning the fish tank, she won’t make her goldfish sick.”'},
    { stimulus: '<p>Billy and Susie were both throwing rocks at Mrs. Smith’s vase. However, Mrs. Smith only saw Billy throwing rocks.</p> <p>She tells you: “Billy will break my vase by throwing rocks.”</p>', prompt: 'Do you think Mrs. Smith would accept the following statement: “If Billy stops throwing rocks at her vase, it won’t break.”'},
    { stimulus: '<p>Billy and Susie were both throwing rocks at Mrs. Smith’s vase. However, Mrs. Smith saw both Billy and Susie throwing rocks.</p><p>She tells you: “Billy will break my vase by throwing rocks.”</p>', prompt: 'Do you think Mrs. Smith would accept the following statement: “If Billy stops throwing rocks at her vase, it won’t break.”'},
    { stimulus: '<p>Billy and Susie were both throwing rocks at Mrs. Smith’s vase. However, Mrs. Smith only saw Billy throwing rocks.</p> <p>She tells you: “If Billy keeps throwing rocks, he will break my vase.”</p>', prompt: 'Do you think Mrs. Smith would accept the following statement: “If Billy stops throwing rocks at her vase, it won’t break.”'},
    { stimulus: '<p>Billy and Susie were both throwing rocks at Mrs. Smith’s vase. However, Mrs. Smith only saw both Billy and Susie throwing rocks.</p><p>She tells you: “If Billy keeps throwing rocks, he will break my vase.”</p>', prompt: 'Do you think Mrs. Smith would accept the following statement: “If Billy stops throwing rocks at her vase, it won’t break.”'},
    { stimulus: '<p>There are two ways John’s eucalyptus tree can die: if it isn’t watered frequently, or if it doesn’t receive enough sunlight. John’s plant sitter has watered the tree infrequently and placed it in the shade. John only knows that the eucalyptus tree has been watered infrequently. </p> <p>He tells you: “If my plant-sitter doesn’t water my eucalyptus tree more often, it will die.”</p>', prompt: 'Do you think John would accept the following statement: “If my plant-sitter doesn’t water my eucalyptus tree more often, it will die.”'},
    { stimulus: '<p>There are two ways John’s eucalyptus tree can die: if it isn’t watered frequently, or if it doesn’t receive enough sunlight. John’s plant-sitter has watered the tree infrequently and placed it in the shade. John knows that the plant-sitter has done both of these things. </p> <p>He tells you: “If my plant-sitter doesn’t water my eucalyptus tree more often, it will die.”</p>', prompt: 'Do you think John would accept the following statement: “If my plant-sitter doesn’t water my eucalyptus tree more often, it will die.”'},
    { stimulus: '<p>There are two ways John’s eucalyptus tree can die: if it isn’t watered frequently, or if it doesn’t receive enough sunlight. John’s plant sitter has watered the tree infrequently and placed it in the shade. John only knows that the eucalyptus tree has been watered infrequently. </p> <p>He tells you: “My plant-sitter will kill the eucalyptus tree by watering it infrequently.”</p>', prompt: 'Do you think John would accept the following statement: “If my plant-sitter doesn’t water my eucalyptus tree more often, it will die.”'},
    { stimulus: '<p>There are two ways John’s eucalyptus tree can die: if it isn’t watered frequently, or if it doesn’t receive enough sunlight. John’s plant-sitter has watered the tree infrequently and placed it in the shade. John knows that the plant-sitter has done both of these things. </p> <p>He tells you: “My plant-sitter will kill the eucalyptus tree by watering it infrequently.”</p>', prompt: 'Do you think John would accept the following statement: “If my plant-sitter doesn’t water my eucalyptus tree more often, it will die.”'},
    { stimulus: '<p>There are two ways Bert can annoy Ernie: he can tap his foot and he can hum. Bert is currently doing both; however, Oscar only sees Bert tapping his foot. </p> <p>He tells you: “Bert tapping his foot will annoy Ernie.”</p>', prompt: 'Do you think Oscar would accept the following statement: “If Bert stops tapping his foot, Ernie won’t be annoyed.”'},
    { stimulus: '<p>There are two ways Bert can annoy Ernie: he can tap his foot and he can hum. Oscar sees that Bert is currently doing both. </p> <p>He tells you: “Bert tapping his foot will annoy Ernie.”</p>', prompt: 'Do you think Oscar would accept the following statement: “If Bert stops tapping his foot, Ernie won’t be annoyed.”'},
    { stimulus: '<p>There are two ways Bert can annoy Ernie: he can tap his foot and he can hum. Bert is currently doing both; however, Oscar only sees Bert tapping his foot. </p> <p>He tells you: “If Bert doesn’t stop tapping his foot, Ernie will be annoyed.”</p>', prompt: 'Do you think Oscar would accept the following statement: “If Bert stops tapping his foot, Ernie won’t be annoyed.”'},
    { stimulus: '<p>There are two ways Bert can annoy Ernie: he can tap his foot and he can hum. Bert is currently doing both; however, Oscar only sees Bert tapping his foot. </p> <p>He tells you: “If Bert doesn’t stop tapping his foot, Ernie will be annoyed.”</p>', prompt: 'Do you think Oscar would accept the following statement: “If Bert stops tapping his foot, Ernie won’t be annoyed.”'},
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
