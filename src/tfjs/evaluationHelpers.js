import * as tf from '@tensorflow/tfjs'
import * as tfvis from '@tensorflow/tfjs-vis'

const classNames = ['Rock', 'Paper', 'Scissors']

const IMAGE_WIDTH = 64
const IMAGE_HEIGHT = 64

export const imageToTensor = img => {
  return tf.tidy(() => {
    img = tf.browser.fromPixels(img)
    // Bring it down to gray
    const gray_mid = img.mean(2)
    const gray = gray_mid.expandDims(2) // back to (width, height, 1)
    const alignCorners = true
    return tf.image.resizeBilinear(
      gray,
      [IMAGE_WIDTH, IMAGE_HEIGHT],
      alignCorners
    )
  })
}

export const doSinglePrediction = async (model, img, options = {}) => {
  // First get input tensor
  const resized = imageToTensor(img)

  const logits = tf.tidy(() => {
    // Singe-element batch of single channel images
    const batched = resized.reshape([1, IMAGE_WIDTH, IMAGE_HEIGHT, 1])

    // return the logits
    return model.predict(batched)
  })

  const values = await logits.data()

  // if we want a visual
  const { feedbackCanvas } = options
  if (feedbackCanvas) {
    await tf.browser.toPixels(resized.div(tf.scalar(255)), feedbackCanvas)
  }
  // cleanup tensors
  resized.dispose()
  logits.dispose()
  // return class + prediction of all
  return classNames.map((className, idx) => ({
    className,
    probability: values[idx]
  }))
}

const doPrediction = (model, data, testDataSize = 420) => {
  const testData = data.nextTestBatch(testDataSize)
  const testxs = testData.xs.reshape([
    testDataSize,
    IMAGE_WIDTH,
    IMAGE_HEIGHT,
    1
  ])
  const labels = testData.labels.argMax([-1])
  const preds = model.predict(testxs).argMax([-1])

  testxs.dispose()
  return [preds, labels]
}

export const showAccuracy = async (model, data, title = 'Accuracy') => {
  const [preds, labels] = doPrediction(model, data)
  const classAccuracy = await tfvis.metrics.perClassAccuracy(labels, preds)
  const container = { name: title, tab: 'Evaluation' }
  tfvis.show.perClassAccuracy(container, classAccuracy, classNames)
  tfvis.visor().setActiveTab('Evaluation')

  labels.dispose()
}

export const showConfusion = async (
  model,
  data,
  title = 'Confusion Matrix'
) => {
  const [preds, labels] = doPrediction(model, data)
  const confusionMatrix = await tfvis.metrics.confusionMatrix(labels, preds)
  const container = { name: title, tab: 'Evaluation' }
  tfvis.render.confusionMatrix(container, {
    values: confusionMatrix,
    tickLabels: classNames
  })

  labels.dispose()
}

export const showExamples = async data => {
  // Create a container in the visor
  const surface = tfvis
    .visor()
    .surface({ name: 'RPS Data Examples', tab: 'Input Data' })

  // Get the examples
  const examples = data.nextTestBatch(42)
  const numExamples = examples.xs.shape[0]

  // Create a canvas element to render each example
  for (let i = 0; i < numExamples; i++) {
    const imageTensor = tf.tidy(() => {
      // Reshape the image to widt*height px
      return examples.xs
        .slice([i, 0], [1, examples.xs.shape[1]])
        .reshape([IMAGE_WIDTH, IMAGE_HEIGHT, 1])
    })

    const canvas = document.createElement('canvas')
    canvas.width = IMAGE_WIDTH
    canvas.height = IMAGE_HEIGHT
    canvas.style = 'margin: 4px;'
    await tf.browser.toPixels(imageTensor, canvas)
    surface.drawArea.appendChild(canvas)

    imageTensor.dispose()
  }
}
