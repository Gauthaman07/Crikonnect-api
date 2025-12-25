import { ApiClient } from 'adminjs'
import { Box, H2, Text } from '@adminjs/design-system'
import React, { useState, useEffect } from 'react'

const Dashboard = () => {
  const [data, setData] = useState({})

  useEffect(() => {
    const api = new ApiClient()
    api.getDashboard().then((response) => {
      setData(response.data)
    })
  }, [])

  return (
    <Box variant="grey">
      <Box variant="white" padding="xl">
        <H2>🏏 Crickonnect Dashboard</H2>
        <Text>Real-time platform statistics</Text>
      </Box>
      
      <Box padding="xl" display="flex" flexDirection="row" flexWrap="wrap">
        {/* Users Card */}
        <Box width={[1, 1/3]} padding="lg">
          <Box variant="white" padding="xl" boxShadow="card">
            <H2>{data.users || '...'}</H2>
            <Text>👥 Registered Users</Text>
          </Box>
        </Box>

        {/* Grounds Card */}
        <Box width={[1, 1/3]} padding="lg">
          <Box variant="white" padding="xl" boxShadow="card">
            <H2>{data.grounds || '...'}</H2>
            <Text>🏟️ Total Grounds</Text>
          </Box>
        </Box>

        {/* Tournaments Card */}
        <Box width={[1, 1/3]} padding="lg">
          <Box variant="white" padding="xl" boxShadow="card">
            <H2>{data.tournaments || '...'}</H2>
            <Text>🏆 Active Tournaments</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard
