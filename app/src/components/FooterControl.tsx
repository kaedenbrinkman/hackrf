import { Box, Card, CardContent, IconButton, Typography } from "@mui/material";
import { Component } from "react";
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import HackRF from "../utils/hackrf";

interface FooterControlProps {
  device: HackRF;
}
interface FooterControlState {
  version: string;
}

class FooterControl extends Component<FooterControlProps, FooterControlState> {
  constructor(props: FooterControlProps) {
    super(props);
    this.state = {
      version: "unknown",
    };
  }

  componentDidMount() {
    this.props.device.readVersionString()
      .then((version) => {
        this.setState({
          version: version,
        });
      });
  }

  render() {
    return (
      <Card sx={{ display: 'flex', width: '100vw' }} className="position-fixed bottom-0">
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <CardContent sx={{ flex: '1 0 auto' }}>
            <Typography component="div" variant="h5">
              HackRF One
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" component="div">
              Connected, v{this.state.version}
            </Typography>
          </CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', pl: 1, pb: 1 }}>
            {/* <IconButton aria-label="play/pause">
              <PlayArrowIcon sx={{ height: 38, width: 38 }} />
            </IconButton> */}
          </Box>
        </Box>
      </Card>
    );
  }
}

export default FooterControl;