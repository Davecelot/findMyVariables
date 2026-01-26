import { render, VerticalSpace } from '@create-figma-plugin/ui'
import { emit } from '@create-figma-plugin/utilities'
import { h } from 'preact'
import { useCallback, useState } from 'preact/hooks'

import { CreateCardHandler } from './types'

function Toggle(props: {
  value: boolean
  onChange: (newValue: boolean) => void
  title: string
  description: string
}) {
  const { value, onChange, title, description } = props

  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: '16px',
        width: '100%',
        cursor: 'pointer',
        padding: '4px 0' // Add some tap area vertical padding
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '40px',
          minWidth: '40px',
          height: '24px',
          borderRadius: '99px',
          backgroundColor: value ? 'rgb(255, 106, 20)' : 'rgb(229, 229, 229)',
          transition: 'background-color 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)',
          marginTop: '2px', // Align with text title
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            transform: value ? 'translateX(16px)' : 'translateX(0)',
            transition: 'transform 0.2s cubic-bezier(0.4, 0.0, 0.2, 1)'
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            fontFamily: "'Clash Grotesk', 'Inter', sans-serif",
            fontSize: '14px',
            fontWeight: 500,
            color: 'rgb(34, 36, 38)',
            marginBottom: '4px',
            lineHeight: '1.2em'
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '12px',
            color: 'rgb(100, 100, 100)',
            lineHeight: '1.4em'
          }}
        >
          {description}
        </div>
      </div>
    </div>
  )
}

function MainButton(props: { onClick: () => void; children: any }) {
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  // Exact shadow values extracted from Framer snippet
  const normalShadows = `
    inset 0px -1px 1px 0px rgb(5, 5, 5),
    inset 0px -8px 2px 0px rgb(19, 20, 21),
    inset 0px -9px 1px 0px rgb(51, 55, 58),
    inset 0px 1px 1px 0px rgb(51, 55, 58),
    inset 0px 3px 3px 0px rgb(39, 43, 45),
    0px 0.723px 0.289px -0.167px rgba(5, 5, 5, 0.06),
    0px 2.746px 1.099px -0.333px rgba(5, 5, 5, 0.114),
    0px 12px 4.8px -0.5px rgba(5, 5, 5, 0.36)
  `

  // Simulated "pressed" state by reducing the bottom shadow depth
  const pressedShadows = `
     inset 0px 1px 4px 0px rgba(0,0,0,0.6),
    inset 0px -2px 1px 0px rgb(19, 20, 21)
  `

  return (
    <button
      onClick={props.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setIsPressed(false)
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      style={{
        width: '100%',
        padding: '16px 24px',
        backgroundColor: 'rgb(34, 36, 38)', // --token-965e5c17...
        color: 'rgb(227, 227, 227)', // --extracted-r6o4lv
        border: 'none',
        borderRadius: '16px',
        cursor: 'pointer',
        fontFamily: "'Clash Grotesk', 'Inter', sans-serif",
        fontSize: '18px',
        fontWeight: 600,
        outline: 'none',
        transform: isPressed ? 'scale(0.98)' : isHovered ? 'translateY(-1px)' : 'none',
        transition: 'transform 0.1s ease, box-shadow 0.2s ease',
        boxShadow: isPressed ? pressedShadows : normalShadows
      }}
    >
      {props.children}
    </button>
  )
}

function Plugin() {
  const [includeDescendants, setIncludeDescendants] = useState(true)
  const [includeTextSegments, setIncludeTextSegments] = useState(true)
  const [includeStyleVariables, setIncludeStyleVariables] = useState(false)

  const handleCreateButtonClick = useCallback(
    function () {
      emit<CreateCardHandler>('CREATE_CARD', {
        includeDescendants,
        includeTextSegments,
        includeStyleVariables
      })
    },
    [includeDescendants, includeTextSegments, includeStyleVariables]
  )

  const iconReq = require('./assets/icon.png')
  const iconSrc = iconReq.default || iconReq

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FDFDFD',
        padding: '32px 24px 48px 24px', // Increased bottom padding
        boxSizing: 'border-box',
        overflowY: 'auto', // Allow scrolling if content overflows
        fontFamily: "'Clash Grotesk', 'Inter', sans-serif",
        color: 'rgb(34, 36, 38)'
      }}
    >
      <style>{`
        @import url('https://api.fontshare.com/v2/css?f[]=clash-grotesk@400,500,600&display=swap');
        
        body, html { 
          margin: 0; 
          padding: 0; 
          height: 100%; 
          background: #FDFDFD;
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <img
          src={iconSrc}
          style={{ width: '48px', height: '48px', marginBottom: '8px' }}
        />
        <h1
          style={{
            margin: 0,
            fontSize: '20px',
            fontWeight: 500,
            letterSpacing: '0px',
            color: 'rgb(34, 36, 38)'
          }}
        >
          Find My Variable
        </h1>
      </div>

      {/* Description */}
      <div style={{ textAlign: 'center', marginBottom: '24px', padding: '0 8px' }}>
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            lineHeight: '1.4em',
            color: 'rgb(34, 36, 38)',
            opacity: 1
          }}
        >
          Select a layer to inspect and start searching for variables.
        </p>
      </div>

      {/* Toggles Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginBottom: 'auto'
        }}
      >
        <Toggle
          value={includeDescendants}
          onChange={setIncludeDescendants}
          title="Search nested layers"
          description="Inspect all layers inside the selection, not just the top level."
        />
        <Toggle
          value={includeTextSegments}
          onChange={setIncludeTextSegments}
          title="Inspect mixed text"
          description="Find variables used in specific text segments (e.g. bold or colored words)."
        />
        <Toggle
          value={includeStyleVariables}
          onChange={setIncludeStyleVariables}
          title="Resolve variables in styles"
          description="Include variables that are used within the applied Paint or Text styles."
        />
      </div>

      <VerticalSpace space="medium" />

      {/* Action Button */}
      <div style={{ marginTop: '24px' }}>
        <MainButton onClick={handleCreateButtonClick}>
          Search for variables
        </MainButton>
      </div>
    </div>
  )
}

export default render(Plugin)
