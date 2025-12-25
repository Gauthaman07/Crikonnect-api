import { ApiClient } from 'adminjs'
import { Box, H2, Text, H5 } from '@adminjs/design-system'
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
        <H2>Crickonnect — Admin Overview</H2>
        <Text>Snapshot of platform activity</Text>
      </Box>
      
      <Box padding="xl" display="flex" flexDirection="row" flexWrap="wrap">
        {/* Users Card */}
        <Box width={[1, 1/3]} padding="lg">
          <Box variant="white" padding="xl" boxShadow="card" textAlign="center">
            <H2>{data.users !== undefined ? data.users : '...'}</H2>
            <H5 mt="lg">Total Users</H5>
            <Text>All verified platform users</Text>
          </Box>
        </Box>

        {/* Grounds Card */}
        <Box width={[1, 1/3]} padding="lg">
          <Box variant="white" padding="xl" boxShadow="card" textAlign="center">
            <H2>{data.grounds !== undefined ? data.grounds : '...'}</H2>
            <H5 mt="lg">Grounds Listed</H5>
            <Text>Available & approved venues</Text>
          </Box>
        </Box>

        {/* Tournaments Card */}
        <Box width={[1, 1/3]} padding="lg">
          <Box variant="white" padding="xl" boxShadow="card" textAlign="center">
            <H2>{data.tournaments !== undefined ? data.tournaments : '...'}</H2>
            <H5 mt="lg">Live Tournaments</H5>
            <Text>Currently running events</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default Dashboard