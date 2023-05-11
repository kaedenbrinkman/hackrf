import { Component } from "react";
import { Link } from "react-router-dom";
import EvStationIcon from '@mui/icons-material/EvStation';
import GarageIcon from '@mui/icons-material/Garage';
// import FlightIcon from '@mui/icons-material/Flight';
// import BluetoothIcon from '@mui/icons-material/Bluetooth';
import RadioIcon from '@mui/icons-material/Radio';
// import WiFiIcon from '@mui/icons-material/Wifi';
// import CellWiFiIcon from '@mui/icons-material/CellWifi';

interface AppListProps {
}
interface AppListState {
}

const apps = [
  {
    name: "RF Spectrum Analyzer",
    path: "/spectrum-analyzer",
    icon: <RadioIcon />,
  },
  {
    name: "Tesla Charge Port",
    path: "/tesla-charge-port",
    icon: <EvStationIcon />,
  },
  {
    name: "Chamberlain Garage Door Opener",
    path: "/chamberlain-garage-door",
    icon: <GarageIcon />,
  },
  {
    name: "FM Radio",
    path: "/fm-radio",
    icon: <RadioIcon />,
  },
  // {
  //   name: "ADS-B Signal Receiver",
  //   path: "/ads-b",
  //   icon: <FlightIcon />,
  // },
  // {
  //   name: "BLE Sniffer",
  //   path: "/ble-sniffer",
  //   icon: <BluetoothIcon />,
  // },
  // {
  //   name: "GSM Sniffer",
  //   path: "/gsm-sniffer",
  //   icon: <CellWiFiIcon />,
  // },
  // {
  //   name: "WiFi Finder",
  //   path: "/wifi-finder",
  //   icon: <WiFiIcon />,
  // }
];

class AppList extends Component<AppListProps, AppListState> {
  constructor(props: AppListProps) {
    super(props);
    this.state = {
    };
  }

  render() {
    return (
      <div>
        {apps.map((app) => {
          return (
            <div className="card m-2">
              <div className="card-body">
                <h5 className="card-title">{app.name}</h5>
                <Link to={app.path} className="btn btn-primary">{app.icon} Open</Link>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}

export default AppList;