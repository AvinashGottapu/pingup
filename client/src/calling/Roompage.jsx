
import React, { useRef } from "react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const Roompage = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.user.value);


  const myCall = async (element) => {
    const appID = 797088622;
    const serverSecret = "41c7889b5a818dbb8a1d1b7f5bd15d77";
    const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
      appID,
      serverSecret,
      roomId,
      Date.now().toString(),
      currentUser ? currentUser.full_name : 'Guest'
    );

    const zp = ZegoUIKitPrebuilt.create(kitToken);
    

    zp.joinRoom({
      container: element,
      scenario: {
        mode: ZegoUIKitPrebuilt.OneONoneCall,
      },
      onLeaveRoom: () => {
        window.history.back();
      }
    });


  };

  return <div className="room-page" style={{
    position: "fixed",
    inset: 0,
    backgroundColor: "#000",
  }}>

    <div ref={myCall} style={{
      width: "100%",
      height: "100%",
    }} />

  </div>;
};

export default Roompage;
