// @flow

import React, { Component } from 'react';
import styled from 'styled-components';

type HeaderAppProps = {
  name: string,
  children: (activeAppCallback: (appName: string) => void, statusCallback: (status: string) => void) => void,
};

type HeaderAppState = {
  activeAppName: string,
  appStatus: string,
};

const CenterHeading = styled.h1`
  text-align: center;
`;

export default class HeaderApp extends Component<HeaderAppProps, HeaderAppState> {
  state = {
    activeAppName: this.props.name,
    appStatus: 'DEFAULT',
  }

  componentDidMount = () => {
    this.props.children(this.updateActiveAppName, this.handleStatusChange);
  }

  updateActiveAppName = (activeAppName: string) => {
    this.setState(() => ({ activeAppName }));
  }

  handleStatusChange = (appStatus: string) => {
    this.setState(() => ({ appStatus }));
  }

  handleClick = (e: SyntheticInputEvent<*>) => {
    window.history.pushState({}, null, e.currentTarget.pathname);
    e.preventDefault();
  }

  render = () => (
    <div>
      <CenterHeading>Simple React Example</CenterHeading>

      <div className="pure-menu pure-menu-horizontal">
        <ul className="pure-menu-list">
          <li className={`pure-menu-item ${this.state.activeAppName === 'FIRST_APP' ? 'pure-menu-selected' : ''} ${this.state.appStatus === 'LOADING' ? 'pure-menu-disabled' : ''}`}>
            <a href="/first-app" onClick={this.handleClick} className="pure-menu-link">
              First App
            </a>
          </li>

          <li className={`pure-menu-item ${this.state.activeAppName === 'SECOND_APP' ? 'pure-menu-selected' : ''} ${this.state.appStatus === 'LOADING' ? 'pure-menu-disabled' : ''}`}>
            <a href="/second-app" onClick={this.handleClick} className="pure-menu-link">
              SecondApp
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
