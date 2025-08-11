import axios from 'axios';

const API_URL = 'http://localhost:5001/api';

async function debugBooking() {
  console.log('Testing: "Can you book me an appointment?"');
  console.log('='.repeat(80));
  
  try {
    const response = await axios.post(`${API_URL}/ai/book-appointment`, {
      request: 'Can you book me an appointment?'
    });
    
    console.log('Direct appointment booking response:');
    console.log('Success:', response.data.success);
    console.log('Message:', response.data.message);
    console.log('Needs Info:', response.data.needsInfo);
    console.log('Confirmation:', response.data.confirmationNumber);
    
    if (response.data.appointment) {
      console.log('Appointment created:', {
        id: response.data.appointment._id,
        patientId: response.data.appointment.patientId,
        confirmationNumber: response.data.appointment.confirmationNumber
      });
    }
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

debugBooking().catch(console.error);