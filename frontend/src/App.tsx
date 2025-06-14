import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Landing } from './components/Landing';
import { Room } from './components/Room';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/room" element={<Room 
          name=""
          localAudioTrack={null}
          localVideoTrack={null}
          isCameraOn={true}
          isMicOn={true}
        />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
