// @flow

import React, { Component } from 'react';
import styled from 'styled-components';

type HeaderAppProps = {
  name: string,
  children: (activeAppCallback: (appName: string) => void) => void,
};

type HeaderAppState = {
  activeAppName: string,
};

const CenterHeading = styled.h1`
  text-align: center;
`;

export default class HeaderApp extends Component<HeaderAppProps, HeaderAppState> {
  state = {
    activeAppName: this.props.name,
  }

  componentDidMount = () => {
    this.props.children(this.updateActiveAppName);
  }

  updateActiveAppName = (activeAppName: string) => {
    this.setState(() => ({ activeAppName }));
  }

  handleClick = (e: SyntheticInputEvent<*>) => {
    window.history.pushState({}, null, e.currentTarget.href);
    e.preventDefault();
  }

  render = () => (
    <div>
      <CenterHeading>Simple React Example</CenterHeading>

      <div className="pure-menu pure-menu-horizontal">
        <ul className="pure-menu-list">
          <li className={`pure-menu-item ${this.state.activeAppName === 'FIRST_APP' ? 'pure-menu-selected' : ''}`}>
            <a href="/apps/guest-template-string" onClick={this.handleClick} className="pure-menu-link">
              Guest Template String
            </a>
          </li>

          <li className={`pure-menu-item ${this.state.activeAppName === 'SECOND_APP' ? 'pure-menu-selected' : ''}`}>
            <a href="/apps/guest-react" onClick={this.handleClick} className="pure-menu-link">
              Guest React
            </a>
          </li>

          <li className="pure-menu-item">
            <a href="/external" onClick={this.handleClick} className="pure-menu-link">
              External Link
            </a>
          </li>

          <li className="pure-menu-item">
            <a href="/apps/guest-timeout?delay=5000" onClick={this.handleClick} className="pure-menu-link">
              Timeout Link
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
