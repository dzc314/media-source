<script setup>
import { onMounted } from 'vue'

import Hls from 'hls.js'
import muxjs from 'mux.js'
import aesjs from 'aes-js'
import { isSupported } from '@/utils/supportUtil'

const videoUrl = 'https://flv.pkgexs.com/t4/index.m3u8'

const parseM3u8 = (content) => {
  const segments = []
  let keyURI, IV
  const rows = content.split('\n')
  rows.forEach((row) => {
    if (row.endsWith('.ts')) {
      segments.push(row)
      return
    }
    if (row.startsWith('#EXT-X-KEY')) {
      row.split(',').forEach((item) => {
        const [key, value] = item.split('=')
        if (key === 'URI') {
          keyURI = value.replaceAll('"', '')
        } else if (key === 'IV') {
          IV = value
        }
      })
    }
  })

  return {
    segments,
    keyURI,
    IV
  }
}

const decrypt = (arrayBuffer, keyBytes, ivBytes) => {
  const aesCbc = new aesjs.ModeOfOperation.cbc(keyBytes, ivBytes)
  const decryptedBytes = aesCbc.decrypt(new Uint8Array(arrayBuffer))
  return decryptedBytes
}
const getmM3u8Content = async (url) => {
  return fetch(url).then(function (response) {
    return response.text()
  })
}

const loadM3u8Data = async (url) => {
  const m3u8Content = await getmM3u8Content(url)
  const { segments, keyURI, IV } = parseM3u8(m3u8Content)
  const ivBytes = getIvBytes(IV)
  let keyBytes
  if (keyURI) {
    const keyContent = await (await fetch(keyURI)).arrayBuffer()
    console.log('keyContent', keyContent)
    keyBytes = new Uint8Array(keyContent)
    console.log('keyBytes', keyBytes)
  }
  return {
    segments,
    ivBytes,
    keyBytes
  }
}
onMounted(async () => {
  const video = document.querySelector('#video')
  // if (!Hls.isSupported()) {
  //   getmM3u8Content(videoUrl).then((text) => {
  //     console.log('src', text)
  //     const src = `data:application/vnd.apple.mpegurl;charset=UTF-8;base64,${btoa(text)}`
  //     video.src = src
  //   })
  //   alert('Hls.isSupported: false')
  //   return
  // }
  // var hls = new Hls()
  // hls.loadSource(videoUrl)
  // hls.attachMedia(video)


  // if (!isSupported()) {
  //   video.src = videoUrl
  //   alert('not supported')
  //   return
  // }

  video.addEventListener('seeked', function (e) {
    // TODO 进度条处理，或自定义进度条
    console.log('seeked', e, this.currentTime, video.currentTime)
  })
  // 转码类
  const transmuxer = new muxjs.mp4.Transmuxer()

  const { segments, ivBytes, keyBytes } = await loadM3u8Data(videoUrl)

  const mediaSource = new MediaSource()

  video.src = URL.createObjectURL(mediaSource)

  const mime = 'video/mp4; codecs="avc1.64001f, mp4a.40.5"'

  mediaSource.addEventListener('sourceopen', sourceOpen)

  function sourceOpen(e) {
    // TODO 计算视频时长(秒)
    // mediaSource.duration = 60
    const sourceBuffer = mediaSource.addSourceBuffer(mime)

    URL.revokeObjectURL(video.src)
    console.log('sourceOpen', segments, mediaSource, sourceBuffer)
    // 获取第一个分片数据
    fetch(segments.shift())
      .then((res) => res.arrayBuffer())
      .then((arrayBuffer) => {
        const decryptedBytes = decrypt(arrayBuffer, keyBytes, ivBytes)
        console.log('decryptedBytes', decryptedBytes)
        sourceBuffer.addEventListener('updateend', appendNextSegment)
        transmuxer.on('data', (segment) => {
          let data = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength)
          data.set(segment.initSegment, 0)
          data.set(segment.data, segment.initSegment.byteLength)
          console.log(`transmuxer.on('data'`, segment, data)
          // console.log(muxjs.mp4.tools.inspect(data))
          sourceBuffer.appendBuffer(data)
        })
        transmuxer.push(new Uint8Array(decryptedBytes))
        transmuxer.flush()
      })
  }

  // 加载后续分片
  function appendNextSegment() {
    const sourceBuffer = this
    console.log('appendNextSegment', mediaSource)

    transmuxer.off('data')
    transmuxer.on('data', (segment) => {
      sourceBuffer.appendBuffer(new Uint8Array(segment.data))
    })

    if (segments.length == 0) {
      mediaSource.endOfStream()
      return
    }

    fetch(segments.shift())
      .then((response) => {
        return response.arrayBuffer()
      })
      .then((response) => {
        const decryptedBytes = decrypt(response, keyBytes, ivBytes)
        transmuxer.push(new Uint8Array(decryptedBytes))
        transmuxer.flush()
      })
  }
})

function getIvBytes(ivStr) {
  let stringValue = (ivStr || '0x').slice(2)
  console.warn('stringValue', stringValue)

  stringValue = (stringValue.length & 1 ? '0' : '') + stringValue

  const value = new Uint8Array(stringValue.length / 2)
  for (let i = 0; i < stringValue.length / 2; i++) {
    value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16)
  }

  return value
}
</script>

<template>
  <header>
    <h1>视频流播放DEMO</h1>
  </header>

  <main>
    <video autoplay muted playsinline id="video" controls></video>
    <!-- <video autoplay muted playsinline id="video1" controls></video> -->
  </main>
</template>

<style scoped>
#video,
#video1 {
  width: 400px;
}
</style>
