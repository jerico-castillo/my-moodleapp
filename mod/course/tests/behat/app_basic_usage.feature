@mod @mod_course @app @javascript
Feature: Test basic usage of one course in app
  In order to participate in one course while using the mobile app
  As a student
  I need basic course functionality to work

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email |
      | teacher1 | Teacher | teacher | teacher1@example.com |
      | student1 | Student | student | student1@example.com |
      | student2 | Student2 | student2 | student2@example.com |
    And the following "courses" exist:
      | fullname | shortname | category |
      | Course 1 | C1 | 0 |
    And the following "course enrolments" exist:
      | user | course | role |
      | teacher1 | C1 | editingteacher |
      | student1 | C1 | student |
    And the following "activities" exist:
      | activity | name            | intro                   | course | idnumber | option                       | section |
      | choice   | Choice course 1 | Test choice description | C1     | choice1  | Option 1, Option 2, Option 3 | 1       |
    And the following "activities" exist:
      | activity | course | idnumber | name                | intro                       | assignsubmission_onlinetext_enabled | section |
      | assign   | C1     | assign1  | assignment          | Test assignment description | 1                                   | 1       |
    And the following "activities" exist:
      | activity   | name            | intro       | course | idnumber | groupmode | assessed | scale[modgrade_type] |
      | forum      | Test forum name | Test forum  | C1     | forum    | 0         | 5        | Point                |
    And the following "activities" exist:
      | activity   | name            | intro       | course | idnumber | groupmode | section |
      | chat       | Test chat name  | Test chat   | C1     | chat     | 0         | 2       |
    And the following "activities" exist:
      | activity | name      | intro        | course | idnumber | section |
      | data     | Web links | Useful links | C1     | data1    | 4       |
    And the following "activities" exist:
      | activity      | name               | intro          | course | idnumber    | groupmode | section |
      | lti           | Test external name | Test external  | C1     | external    | 0         | 1       |
    And the following "activities" exist:
      | activity      | name               | intro          | course | idnumber    | groupmode | section |
      | feedback      | Test feedback name | Test feedback  | C1     | feedback    | 0         | 3       |
    And the following "activities" exist:
      | activity | name          | intro                | course | idnumber  | section |
      | glossary | Test glossary | glossary description | C1     | gloss1    | 5       |
    And the following "activities" exist:
      | activity   | name   | intro              | course | idnumber | section |
      | quiz       | Quiz 1 | Quiz 1 description | C1     | quiz1    | 2       |
    And the following "question categories" exist:
      | contextlevel | reference | name           |
      | Course       | C1        | Test questions |
    And the following "questions" exist:
      | questioncategory | qtype       | name  | questiontext                |
      | Test questions   | truefalse   | TF1   | Text of the first question  |
      | Test questions   | truefalse   | TF2   | Text of the second question |
    And quiz "Quiz 1" contains the following questions:
      | question | page |
      | TF1      | 1    |
      | TF2      | 2    |
    And the following "activities" exist:
      | activity    | name             | intro        | course | idnumber  | groupmode | section |
      | survey      | Test survey name | Test survey  | C1     | survey    | 0         | 1       |
    And the following "activities" exist:
      | activity    | name             | intro        | course | idnumber  | groupmode |
      | wiki        | Test wiki name   | Test wiki    | C1     | wiki      | 0         |
    And the following "activities" exist:
      | activity      | name               | intro          | course | idnumber    | groupmode | section |
      | lesson        | Test lesson name   | Test lesson    | C1     | lesson      | 0         | 3       |
    And the following "activities" exist:
      | activity      | name               | intro          | course | idnumber    | groupmode | section |
      | scorm         | Test scorm name    | Test scorm     | C1     | scorm       | 0         | 2       |
    And the following "activities" exist:
      | activity      | name                  | intro             | course | idnumber       | groupmode | section |
      | workshop      | Test workshop name    | Test workshop     | C1     | workshop       | 0         | 3       |

  Scenario: View course contents
    When I enter the app
    And I log in as "student1"
    And I press "Course 1" near "Course overview" in the app
    Then the header should be "Course 1" in the app
    And I should find "Choice course 1" in the app
    And I should find "assignment" in the app
    And I should find "Test forum name" in the app
    And I should find "Test chat name" in the app
    And I should find "Web links" in the app
    And I should find "Test external name" in the app
    And I should find "Test feedback name" in the app
    And I should find "Test glossary" in the app
    And I should find "Quiz 1" in the app
    And I should find "Test survey name" in the app
    And I should find "Test wiki name" in the app
    And I should find "Test lesson name" in the app
    And I should find "Test scorm name" in the app
    And I should find "Test workshop name" in the app

    When I press "Choice course 1" in the app
    Then the header should be "Choice course 1" in the app

    When I press the back button in the app
    And I press "assignment" in the app
    Then the header should be "assignment" in the app

    When I press the back button in the app
    And I press "Test forum name" in the app
    Then the header should be "Test forum name" in the app

    When I press the back button in the app
    And I press "Test chat name" in the app
    Then the header should be "Test chat name" in the app

    When I press the back button in the app
    And I press "Web links" in the app
    Then the header should be "Web links" in the app

    When I press the back button in the app
    And I press "Test external name" in the app
    Then the header should be "Test external name" in the app

    When I press the back button in the app
    And I press "Test feedback name" in the app
    And I press "OK" in the app
    Then the header should be "Test feedback name" in the app

    When I press the back button in the app
    And I press "Test glossary" in the app
    Then the header should be "Test glossary" in the app

    When I press the back button in the app
    And I press "Quiz 1" in the app
    Then the header should be "Quiz 1" in the app

    When I press the back button in the app
    And I press "Test survey name" in the app
    Then the header should be "Test survey name" in the app

    When I press the back button in the app
    And I press "Test wiki name" in the app
    And I press "OK" in the app
    Then the header should be "Test wiki name" in the app

    When I press the back button in the app
    And I press "Test lesson name" in the app
    Then the header should be "Test lesson name" in the app

    When I press the back button in the app
    And I press "Test scorm name" in the app
    Then the header should be "Test scorm name" in the app

    When I press the back button in the app
    And I press "Test workshop name" in the app
    Then the header should be "Test workshop name" in the app

  Scenario: View section contents
    When I enter the app
    And I log in as "student1"
    And I press "Course 1" near "Course overview" in the app
    Then the header should be "Course 1" in the app
    And I should find "Choice course 1" in the app
    And I should find "assignment" in the app
    And I should find "Test forum name" in the app
    And I should find "Test chat name" in the app
    And I should find "Web links" in the app
    And I should find "Test external name" in the app
    And I should find "Test feedback name" in the app
    And I should find "Test glossary" in the app
    And I should find "Quiz 1" in the app
    And I should find "Test survey name" in the app
    And I should find "Test wiki name" in the app
    And I should find "Test lesson name" in the app
    And I should find "Test scorm name" in the app
    And I should find "Test workshop name" in the app

    When I press "Section:" in the app
    And I press "General" near "Sections" "h2" in the app
    Then I should find "Test forum name" in the app
    And I should find "Test wiki name" in the app
    But I should not find "Choice course 1" in the app
    And I should not find "assignment" in the app
    And I should not find "Test chat name" in the app
    And I should not find "Web links" in the app
    And I should not find "Test external name" in the app
    And I should not find "Test feedback name" in the app
    And I should not find "Test glossary" in the app
    And I should not find "Quiz 1" in the app
    And I should not find "Test survey name" in the app
    And I should not find "Test lesson name" in the app
    And I should not find "Test scorm name" in the app
    And I should not find "Test workshop name" in the app

    When I press "Test forum name" in the app
    Then the header should be "Test forum name" in the app

    When I press the back button in the app
    And I press "Test wiki name" in the app
    And I press "OK" in the app
    Then the header should be "Test wiki name" in the app

    When I press the back button in the app
    And I press "Section:" in the app
    And I press "Topic 1" near "Sections" "h2" in the app
    Then I should find "Choice course 1" in the app
    And I should find "assignment" in the app
    And I should find "Test external name" in the app
    And I should find "Test survey name" in the app
    But I should not find "Test forum name" in the app
    And I should not find "Test chat name" in the app
    And I should not find "Web links" in the app
    And I should not find "Test feedback name" in the app
    And I should not find "Test glossary" in the app
    And I should not find "Quiz 1" in the app
    And I should not find "Test wiki name" in the app
    And I should not find "Test lesson name" in the app
    And I should not find "Test scorm name" in the app
    And I should not find "Test workshop name" in the app

    When I press "Choice course 1" in the app
    Then the header should be "Choice course 1" in the app

    When I press the back button in the app
    And I press "assignment" in the app
    Then the header should be "assignment" in the app

    When I press the back button in the app
    And I press "Test external name" in the app
    Then the header should be "Test external name" in the app

    When I press the back button in the app
    And I press "Test survey name" in the app
    Then the header should be "Test survey name" in the app

    When I press the back button in the app
    And I press "Section:" in the app
    And I press "Topic 2" near "Sections" "h2" in the app
    Then I should find "Quiz 1" in the app
    And I should find "Test chat name" in the app
    And I should find "Test scorm name" in the app
    But I should not find "Choice course 1" in the app
    And I should not find "assignment" in the app
    And I should not find "Test forum name" in the app
    And I should not find "Web links" in the app
    And I should not find "Test external name" in the app
    And I should not find "Test feedback name" in the app
    And I should not find "Test glossary" in the app
    And I should not find "Test survey name" in the app
    And I should not find "Test wiki name" in the app
    And I should not find "Test lesson name" in the app
    And I should not find "Test workshop name" in the app

    When I press "Test chat name" in the app
    Then the header should be "Test chat name" in the app

    When I press the back button in the app
    And I press "Quiz 1" in the app
    Then the header should be "Quiz 1" in the app

    When I press the back button in the app
    And I press "Test scorm name" in the app
    Then the header should be "Test scorm name" in the app

    When I press the back button in the app
    And I press "Section:" in the app
    And I press "Topic 3" near "Sections" "h2" in the app
    Then I should find "Test feedback name" in the app
    And I should find "Test lesson name" in the app
    And I should find "Test workshop name" in the app
    But I should not find "Choice course 1" in the app
    And I should not find "assignment" in the app
    And I should not find "Test forum name" in the app
    And I should not find "Test chat name" in the app
    And I should not find "Web links" in the app
    And I should not find "Test external name" in the app
    And I should not find "Test glossary" in the app
    And I should not find "Quiz 1" in the app
    And I should not find "Test survey name" in the app
    And I should not find "Test wiki name" in the app
    And I should not find "Test scorm name" in the app

    When I press "Test feedback name" in the app
    And I press "OK" in the app
    Then the header should be "Test feedback name" in the app

    When I press the back button in the app
    And I press "Test lesson name" in the app
    Then the header should be "Test lesson name" in the app

    When I press the back button in the app
    And I press "Test workshop name" in the app
    Then the header should be "Test workshop name" in the app

    When I press the back button in the app
    And I press "Section:" in the app
    And I press "Topic 4" near "Sections" "h2" in the app
    Then I should find "Web links" in the app
    But I should not find "Choice course 1" in the app
    And I should not find "assignment" in the app
    And I should not find "Test forum name" in the app
    And I should not find "Test chat name" in the app
    And I should not find "Test external name" in the app
    And I should not find "Test feedback name" in the app
    And I should not find "Test glossary" in the app
    And I should not find "Quiz 1" in the app
    And I should not find "Test survey name" in the app
    And I should not find "Test wiki name" in the app
    And I should not find "Test lesson name" in the app
    And I should not find "Test scorm name" in the app
    And I should not find "Test workshop name" in the app

    When I press "Web links" in the app
    Then the header should be "Web links" in the app

    When I press the back button in the app
    And I press "Section:" in the app
    And I press "Topic 5" near "Sections" "h2" in the app
    Then I should find "Test glossary" in the app
    But I should not find "Choice course 1" in the app
    And I should not find "assignment" in the app
    And I should not find "Test forum name" in the app
    And I should not find "Test chat name" in the app
    And I should not find "Web links" in the app
    And I should not find "Test external name" in the app
    And I should not find "Test feedback name" in the app
    And I should not find "Quiz 1" in the app
    And I should not find "Test survey name" in the app
    And I should not find "Test wiki name" in the app
    And I should not find "Test lesson name" in the app
    And I should not find "Test scorm name" in the app
    And I should not find "Test workshop name" in the app

    When I press "Test glossary" in the app
    Then the header should be "Test glossary" in the app

  Scenario: Navigation between sections using the bottom arrows
    When I enter the app
    And I log in as "student1"
    And I press "Course 1" near "Course overview" in the app
    Then the header should be "Course 1" in the app
    And I should find "Choice course 1" in the app
    And I should find "assignment" in the app
    And I should find "Test forum name" in the app
    And I should find "Test chat name" in the app
    And I should find "Web links" in the app
    And I should find "Test external name" in the app
    And I should find "Test feedback name" in the app
    And I should find "Test glossary" in the app
    And I should find "Quiz 1" in the app
    And I should find "Test survey name" in the app
    And I should find "Test wiki name" in the app
    And I should find "Test lesson name" in the app
    And I should find "Test scorm name" in the app
    And I should find "Test workshop name" in the app

    When I press "Section:" in the app
    And I press "General" near "Sections" "h2" in the app
    Then I should find "General" in the app
    And I should find "Next: Topic 1" in the app
    But I should not find "Topic 2" in the app
    And I should not find "Topic 3" in the app
    And I should not find "Topic 4" in the app
    And I should not find "Topic 5" in the app
    And I should not find "Previous:" in the app

    When I press "Next:" in the app
    Then I should find "Topic 1" in the app
    And I should find "Previous: General" in the app
    And I should find "Next: Topic 2" in the app
    But I should not find "Topic 3" in the app
    And I should not find "Topic 4" in the app
    And I should not find "Topic 5" in the app

    When I press "Next:" in the app
    Then I should find "Topic 2" in the app
    And I should find "Previous: Topic 1" in the app
    And I should find "Next: Topic 3" in the app
    But I should not find "General" in the app
    And I should not find "Topic 4" in the app
    And I should not find "Topic 5" in the app

    When I press "Next:" in the app
    Then I should find "Topic 3" in the app
    And I should find "Previous: Topic 2" in the app
    And I should find "Next: Topic 4" in the app
    But I should not find "General" in the app
    And I should not find "Topic 1" in the app
    And I should not find "Topic 5" in the app

    When I press "Next:" in the app
    Then I should find "Topic 4" in the app
    And I should find "Previous: Topic 3" in the app
    And I should find "Next: Topic 5" in the app
    But I should not find "General" in the app
    And I should not find "Topic 1" in the app
    And I should not find "Topic 2" in the app

    When I press "Next:" in the app
    Then I should find "Topic 5" in the app
    And I should find "Previous: Topic 4" in the app
    But I should not find "General" in the app
    And I should not find "Topic 1" in the app
    And I should not find "Topic 2" in the app
    And I should not find "Topic 3" in the app
    And I should not find "Next:" in the app

    When I press "Previous:" in the app
    Then I should find "Topic 4" in the app
    And I should find "Previous: Topic 3" in the app
    And I should find "Next: Topic 5" in the app
    But I should not find "General" in the app
    And I should not find "Topic 1" in the app
    And I should not find "Topic 2" in the app

  Scenario: Self enrol
    Given I enter the app
    And I log in as "teacher1"
    And I press "Course 1" near "Course overview" in the app
    And I press "Display options" in the app
    And I press "Course summary" in the app
    And I press "Open in browser" in the app
    And I switch to the browser tab opened by the app
    And I log in as "teacher1"
    And I press "Actions menu"
    And I follow "More..."
    And I follow "Users"
    And I follow "Enrolment methods"
    And I click on "Enable" "icon" in the "Self enrolment (Student)" "table_row"
    And I close the browser tab opened by the app
    When I enter the app
    And I log in as "student2"
    And I press "Site home" in the app
    And I press "Available courses" in the app
    And I press "Course 1" in the app
    And I press "Enrol me" in the app
    And I press "OK" in the app
    And I wait loading to finish in the app
    And I press "Contents" in the app
    Then the header should be "Course 1" in the app
    And I should find "Choice course 1" in the app
    And I should find "assignment" in the app
    And I should find "Test forum name" in the app
    And I should find "Test chat name" in the app
    And I should find "Web links" in the app
    And I should find "Test external name" in the app
    And I should find "Test feedback name" in the app
    And I should find "Test glossary" in the app
    And I should find "Quiz 1" in the app
    And I should find "Test survey name" in the app
    And I should find "Test wiki name" in the app
    And I should find "Test lesson name" in the app
    And I should find "Test scorm name" in the app
    And I should find "Test workshop name" in the app

  Scenario: Guest access
    Given I enter the app
    And I log in as "teacher1"
    And I press "Course 1" near "Course overview" in the app
    And I press "Display options" in the app
    And I press "Course summary" in the app
    And I press "Open in browser" in the app
    And I switch to the browser tab opened by the app
    And I log in as "teacher1"
    And I press "Actions menu"
    And I follow "More..."
    And I follow "Users"
    And I follow "Enrolment methods"
    And I click on "Enable" "icon" in the "Guest access" "table_row"
    And I close the browser tab opened by the app
    When I enter the app
    And I log in as "student2"
    And I press "Site home" in the app
    And I press "Available courses" in the app
    And I press "Course 1" in the app
    Then I should find "Download course" in the app
    And I should find "Contents" in the app

    When I press "Contents" in the app
    Then the header should be "Course 1" in the app
    And I should find "Choice course 1" in the app
    And I should find "assignment" in the app
    And I should find "Test forum name" in the app
    And I should find "Test chat name" in the app
    And I should find "Web links" in the app
    And I should find "Test feedback name" in the app
    And I should find "Test glossary" in the app
    And I should find "Quiz 1" in the app
    And I should find "Test survey name" in the app
    And I should find "Test wiki name" in the app
    And I should find "Test lesson name" in the app
    And I should find "Test scorm name" in the app
    And I should find "Test workshop name" in the app

  Scenario: View blocks below/beside contents also when All sections selected
    Given I enter the app
    And I log in as "teacher1"
    And I press "Course 1" near "Course overview" in the app
    And I press "Display options" in the app
    And I press "Course summary" in the app
    And I press "Open in browser" in the app
    And I switch to the browser tab opened by the app
    And I log in as "teacher1"
    And I press "Turn editing on"
    And I click on "Side panel" "button"
    And I follow "Add a block"
    And I follow "HTML"
    And I click on "#theme_boost-drawers-blocks [aria-label=\"Close drawer\"]" "css_element"
    And I click on "Side panel" "button"
    And I follow "Add a block"
    And I follow "Activities"
    And I click on "Actions menu" "icon" in the "#action-menu-toggle-0" "css_element"
    And I follow "Configure (new HTML block) block"
    And I set the field "HTML block title" to "HTML title test"
    And I set the field "Content" to "body test"
    And I press "Save changes"
    And I close the browser tab opened by the app
    When I enter the app
    And I log in as "student1"
    And I press "Course 1" near "Course overview" in the app
    Then the header should be "Course 1" in the app
    And I should find "Choice course 1" in the app
    And I should find "assignment" in the app
    And I should find "Test forum name" in the app
    And I should find "Test chat name" in the app
    And I should find "Web links" in the app
    And I should find "Test external name" in the app
    And I should find "Test feedback name" in the app
    And I should find "Test glossary" in the app
    And I should find "Quiz 1" in the app
    And I should find "Test survey name" in the app
    And I should find "Test wiki name" in the app
    And I should find "Test lesson name" in the app
    And I should find "Test scorm name" in the app
    And I should find "Test workshop name" in the app
    And I should find "HTML title test" in the app
    And I should find "body test" in the app
    And I should find "Activities" in the app
