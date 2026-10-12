const socket = io();


let stream = null;

let pc = null;

let partnerId = null;

let muted = false;

let cameraOff = false;


const $ = id =>
  document.getElementById(id);


const rtcConfig = {

  iceServers: [

    {
      urls:
        "stun:stun.l.google.com:19302"
    },

    {
      urls:
        "stun:stun.cloudflare.com:3478"
    }

  ]

};


/* TOAST */

function toast(message){

  $("toast").textContent =
    message;

  $("toast").style.display =
    "block";

  setTimeout(() => {

    $("toast").style.display =
      "none";

  }, 2200);

}


/* CLOSE PEER */

function closePeer(){

  if(pc){

    pc.onicecandidate = null;

    pc.ontrack = null;

    pc.close();

    pc = null;

  }


  $("remoteVideo").srcObject =
    null;

  $("remoteQ").style.display =
    "block";

}


/* CAMERA */

async function media(){

  if(stream)
    return;


  stream =
    await navigator.mediaDevices
      .getUserMedia({

        video:true,

        audio:true

      });


  $("localVideo").srcObject =
    stream;


  $("localLetter").style.display =
    "none";

}


/* CREATE PEER */

async function peer(
  initiator
){

  closePeer();


  pc =
    new RTCPeerConnection(
      rtcConfig
    );


  stream
    .getTracks()
    .forEach(track => {

      pc.addTrack(
        track,
        stream
      );

    });


  /* REMOTE VIDEO */

  pc.ontrack =
    event => {

      $("remoteVideo")
        .srcObject =
        event.streams[0];


      $("remoteQ")
        .style.display =
        "none";

    };


  /* ICE */

  pc.onicecandidate =
    event => {

      if(
        event.candidate &&
        partnerId
      ){

        socket.emit(
          "signal",
          {

            to:partnerId,

            data:{
              candidate:
                event.candidate
            }

          }
        );

      }

    };


  /* CREATE OFFER */

  if(initiator){

    const offer =
      await pc.createOffer();


    await pc.setLocalDescription(
      offer
    );


    socket.emit(
      "signal",
      {

        to:partnerId,

        data:{
          description:
            pc.localDescription
        }

      }
    );

  }

}


/* START */

$("start").onclick =
  async () => {

    try{

      await media();


      $("start").textContent =
        "🔎 Searching...";


      socket.emit(
        "joinQueue"
      );


      toast(
        "Finding a match…"
      );

    }

    catch(error){

      console.error(error);

      toast(
        "Camera/microphone permission is required."
      );

    }

  };


/* MATCH FOUND */

socket.on(
  "matched",
  async data => {

    partnerId =
      data.partnerId;


    await peer(
      data.initiator
    );


    $("start").textContent =
      "🟢 Connected";


    toast(
      "Matched!"
    );

  }
);


/* SIGNAL */

socket.on(
  "signal",
  async ({
    from,
    data
  }) => {

    partnerId = from;


    if(!pc){

      await peer(false);

    }


    /* OFFER / ANSWER */

    if(
      data.description
    ){

      await pc
        .setRemoteDescription(
          data.description
        );


      if(
        data.description.type ===
        "offer"
      ){

        const answer =
          await pc.createAnswer();


        await pc
          .setLocalDescription(
            answer
          );


        socket.emit(
          "signal",
          {

            to:partnerId,

            data:{
              description:
                pc.localDescription
            }

          }
        );

      }

    }


    /* ICE */

    if(
      data.candidate
    ){

      try{

        await pc.addIceCandidate(
          data.candidate
        );

      }

      catch(error){

        console.log(
          error
        );

      }

    }

  }
);


/* NEXT */

$("next").onclick =
  () => {

    if(!stream)
      return;


    closePeer();


    partnerId = null;


    socket.emit(
      "next"
    );


    $("start").textContent =
      "🔎 Searching...";


    toast(
      "Finding next match…"
    );

  };


/* MUTE */

$("mute").onclick =
  () => {

    if(!stream)
      return;


    muted = !muted;


    stream
      .getAudioTracks()
      .forEach(track => {

        track.enabled =
          !muted;

      });


    $("mute").textContent =
      muted
        ? "🔇"
        : "🎙️";

  };


/* CAMERA */

$("camera").onclick =
  () => {

    if(!stream)
      return;


    cameraOff =
      !cameraOff;


    stream
      .getVideoTracks()
      .forEach(track => {

        track.enabled =
          !cameraOff;

      });


    $("camera").textContent =
      cameraOff
        ? "🚫"
        : "📹";

  };


/* PARTNER LEFT */

socket.on(
  "partnerLeft",
  () => {

    closePeer();

    partnerId = null;


    if(stream){

      $("start").textContent =
        "🔎 Searching...";


      socket.emit(
        "joinQueue"
      );


      toast(
        "Partner left — searching again"
      );

    }

  }
);


/* CHAT SEND */

$("send").onclick =
  () => {

    const text =
      $("message")
        .value
        .trim();


    if(!text)
      return;


    if(!partnerId){

      toast(
        "You need an active match"
      );

      return;

    }


    addMessage(
      text,
      true
    );


    socket.emit(
      "chatMessage",
      {

        to:partnerId,

        text

      }
    );


    $("message").value =
      "";

  };


/* ENTER CHAT */

$("message")
  .addEventListener(
    "keydown",
    event => {

      if(
        event.key ===
        "Enter"
      ){

        $("send").click();

      }

    }
  );


/* RECEIVE CHAT */

socket.on(
  "chatMessage",
  data => {

    addMessage(
      data.text,
      false
    );

  }
);


/* ADD MESSAGE */

function addMessage(
  text,
  mine
){

  const box =
    $("messages");


  const empty =
    box.querySelector(
      "small"
    );


  if(empty)
    empty.remove();


  const div =
    document.createElement(
      "div"
    );


  div.className =
    "bubble";


  if(mine)
    div.classList.add(
      "mine"
    );


  /*
    textContent is used
    instead of innerHTML
    to prevent HTML injection.
  */

  div.textContent =
    text;


  box.appendChild(
    div
  );


  box.scrollTop =
    box.scrollHeight;

}


/* PROFILE */

$("save").onclick =
  () => {

    const name =
      $("name")
        .value
        .trim() ||
      "Guest";


    const gender =
      $("gender").value;


    const profile = {

      name,

      gender

    };


    localStorage.setItem(
      "chill_profile",
      JSON.stringify(
        profile
      )
    );


    $("profileBtn")
      .textContent =
      name[0]
        .toUpperCase();


    toast(
      "Profile saved"
    );

  };


/* LOAD PROFILE */

const saved =
  JSON.parse(
    localStorage.getItem(
      "chill_profile"
    ) || "null"
  );


if(saved){

  $("name").value =
    saved.name;


  $("gender").value =
    saved.gender;


  $("profileBtn")
    .textContent =
    saved.name[0]
      .toUpperCase();

}


/* REPORT */

$("report").onclick =
  async () => {

    if(!partnerId){

      toast(
        "No active match"
      );

      return;

    }


    const reason =
      prompt(
        "Reason for report?"
      );


    if(!reason)
      return;


    await fetch(
      "/api/report",
      {

        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify({

            reportedUser:
              partnerId,

            reason

          })

      }
    );


    toast(
      "Report submitted"
    );

  };


/* BLOCK */

$("block").onclick =
  () => {

    if(!partnerId){

      toast(
        "No active match"
      );

      return;

    }


    socket.emit(
      "block",
      {
        to:partnerId
      }
    );

  };


socket.on(
  "blockedDone",
  () => {

    closePeer();

    partnerId = null;


    toast(
      "User blocked"
    );


    socket.emit(
      "joinQueue"
    );

  }
);


/* ONLINE COUNT */

async function updateOnline(){

  try{

    const response =
      await fetch(
        "/api/health"
      );


    const data =
      await response.json();


    $("online")
      .textContent =
      data.online;

  }

  catch(error){

    console.log(error);

  }

}


updateOnline();


setInterval(
  updateOnline,
  5000
);