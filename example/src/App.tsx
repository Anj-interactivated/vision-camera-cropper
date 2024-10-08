import * as React from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, SafeAreaView, Dimensions, Pressable, View, Modal, Text } from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useFrameProcessor } from 'react-native-vision-camera';
import { useSharedValue } from 'react-native-worklets-core';
import { type CropRegion, crop, rotateImage } from 'vision-camera-cropper';
import { Svg, Rect, Circle, Image } from 'react-native-svg';

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isActive,setIsActive] = useState(true);
  const [imageData,setImageData] = useState<undefined|string>(undefined);
  const setImageDataJS = Worklets.createRunOnJS(setImageData);
  const [frameWidth, setFrameWidth] = useState(1080);
  const [frameHeight, setFrameHeight] = useState(1920);
  const [cropRegion,setCropRegion] = useState({
    left: 0,
    top: 0,
    width: 100,
    height: 100
  });
  const cropRegionShared = useSharedValue<undefined|CropRegion>(undefined);
  const frameWidthShared = useSharedValue(1080);
  const frameHeightShared = useSharedValue(1920);
  const taken = useSharedValue(false);
  const shouldTake = useSharedValue(false);
  const [pressed,setPressed] = React.useState(false);
  const device = useCameraDevice("back");
  const format = useCameraFormat(device, [
    { videoAspectRatio: 16 / 9 },
    { photoAspectRatio: 16 / 9 },
    { videoResolution: { width: 1920, height: 1080 } },
    { fps: 30 },
  ]);
  const updateFrameSize = (width:number, height:number) => {
    if (width != frameWidthShared.value && height!= frameHeightShared.value) {
      frameWidthShared.value = width;
      frameHeightShared.value = height;
      setFrameWidth(width);
      setFrameHeight(height);
      if (HasRotation()){
        updateCropRegion({width:height,height:width});
      }else{
        updateCropRegion({width:width,height:height});
      }
    }
  }

  const updateCropRegion = (size?:{width:number,height:number}) => {
    //const size = getFrameSize();
    if (!size) {
      size = getFrameSize();
    } 
    let region;
    if (size.width>size.height) {
      let regionWidth = 0.7*size.width;
      let desiredRegionHeight = regionWidth/(85.6/54);
      let height = Math.ceil(desiredRegionHeight/size.height*100);
      region = {
        left:15,
        width:70,
        top:10,
        height:height
      };
    }else{
      let regionWidth = 0.8*size.width;
      let desiredRegionHeight = regionWidth/(85.6/54);
      let height = Math.ceil(desiredRegionHeight/size.height*100);
      region = {
        left:10,
        width:80,
        top:20,
        height:height
      };
    }
    setCropRegion(region);
    cropRegionShared.value = region;
    console.log(region)
  }

  const updateFrameSizeJS = Worklets.createRunOnJS(updateFrameSize);
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet'
    //console.log(frame.width+"x"+frame.height);
    updateFrameSizeJS(frame.width, frame.height);
    if (taken.value == false && shouldTake.value == true && cropRegionShared.value != undefined) {
      console.log(cropRegionShared.value);
      const result = crop(frame,{cropRegion:cropRegionShared.value,includeImageBase64:true});
      //console.log(result);
      if (result.base64) {
        setImageDataJS("data:image/jpeg;base64,"+result.base64);
        taken.value = true;
      }
      shouldTake.value = false;
    }
  }, [])

  useEffect(() => {
    (async () => {
      console.log("mounted");
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
      setIsActive(true);
      updateCropRegion();
    })();
  }, []);

  useEffect(() => {
    updateCropRegion();
  }, [frameWidth,frameHeight]);

  const getViewBox = () => {
    const frameSize = getFrameSize();
    console.log("getViewBox");
    console.log(frameSize);
    const viewBox = "0 0 "+frameSize.width+" "+frameSize.height;
    return viewBox;
  }

  const getViewBoxForCroppedImage = () => {
    const frameSize = getFrameSize();
    const viewBox = "0 0 "+(frameSize.width*cropRegion.width/100)+" "+(frameSize.height*cropRegion.height/100);
    return viewBox;
  }

  const getFrameSize = ():{width:number,height:number} => {
    let width:number, height:number;
    if (HasRotation()){
      width = frameHeight;
      height = frameWidth;
    }else {
      width = frameWidth;
      height = frameHeight;
    }
    return {width:width,height:height};
  }

  const HasRotation = () => {
    let value = false
    if (!(frameWidth>frameHeight && Dimensions.get('window').width>Dimensions.get('window').height)){
      value = true;
    }
    return value;
  }

  const renderImage = () =>{
    if (imageData != undefined) {
      return (
        <Svg style={styles.srcImage} viewBox={getViewBoxForCroppedImage()}>
          <Image
            href={{uri:imageData}}
          />
        </Svg>
      );
    }
    return null;
  }

  const rotateTakenImage = async () => {
    console.log("rotate")
    if (imageData) {
      console.log("hasimage")
      let rotated = await rotateImage(removeDataURLHead(imageData),90);
      setImageData("data:image/jpeg;base64,"+rotated);
    }
  }

  const removeDataURLHead = (dataURL:string) => {
    return dataURL.substring(dataURL.indexOf(",")+1,dataURL.length);
  }

  return (
    <SafeAreaView style={styles.container}>
      {device != null &&
      hasPermission && (
      <>
        <Camera
          style={StyleSheet.absoluteFill}
          isActive={isActive}
          device={device}
          format={format}
          frameProcessor={frameProcessor}
          pixelFormat='yuv'
          resizeMode='contain'
        />
        <Svg preserveAspectRatio='xMidYMid slice' style={StyleSheet.absoluteFill} viewBox={getViewBox()}>
          <Rect 
            x={cropRegion.left/100*getFrameSize().width}
            y={cropRegion.top/100*getFrameSize().height}
            width={cropRegion.width/100*getFrameSize().width}
            height={cropRegion.height/100*getFrameSize().height}
            strokeWidth="2"
            stroke="red"
            fillOpacity={0.0}
          />
        </Svg>
        <View style={styles.control}>
          <View style={{flex:1.0}}>
            <Svg viewBox={'0 0 '+getWindowWidth()+' '+getWindowHeight()*0.1}>
              <Circle
                x={getWindowWidth()/2}
                y={getWindowHeight()*0.1/2}
                r={getWindowHeight()*0.1/2}
                fill="gray"
              >
              </Circle>
              <Circle
                x={getWindowWidth()/2}
                y={getWindowHeight()*0.1/2}
                r={getWindowHeight()*0.08/2}
                fill={pressed?"gray":"white"}
                onPressIn={()=>{
                  console.log("on press in ")
                  setPressed(true);
                }}
                onPressOut={()=>{
                  setPressed(false);
                  shouldTake.value = true;
                }}
              >
              </Circle>
            </Svg>
          </View>  
        </View>
        <Modal
          animationType="slide"
          transparent={true}
          visible={(imageData != undefined)}
          onRequestClose={() => {
            setImageData(undefined);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              {renderImage()}
              <View style={styles.buttonView}>
                  <Pressable
                    style={[styles.button, styles.buttonInModal]}
                    onPress={() => {
                      setImageData(undefined);
                      taken.value = false;
                    }}
                  >
                    <Text style={styles.textStyle}>Rescan</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.button, styles.buttonInModal]}
                    onPress={() => {
                      rotateTakenImage();
                    }}
                  >
                    <Text style={styles.textStyle}>Rotate</Text>
                  </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </>)}
    </SafeAreaView>
  );
}

const getWindowWidth = () => {
  return Dimensions.get("window").width;
}

const getWindowHeight = () => {
  return Dimensions.get("window").height;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
  control:{
    flexDirection:"row",
    position: 'absolute',
    bottom: 0,
    height: "10%",
    width:"100%",
    alignSelf:"flex-start",
    borderColor: "white",
    borderWidth: 0.1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: 'center',
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22
  },
  modalView: {
    margin: 20,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  buttonView:{
    flexDirection:'row',
  },
  button: {
    borderRadius: 20,
    padding: 10,
    margin: 5
  },
  buttonOpen: {
    backgroundColor: "#F194FF",
  },
  buttonInModal: {
    backgroundColor: "#2196F3",
  },
  textStyle: {
    color: "white",
    fontWeight: "bold",
    textAlign: "center",
  },
  srcImage: {
    width: getWindowWidth()*0.7,
    height: 100,
    resizeMode: "contain"
  },
});
